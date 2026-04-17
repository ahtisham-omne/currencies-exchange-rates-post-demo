import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Check,
  Search,
  X,
  Star,
  Eye,
  Users,
  Building2,
} from "lucide-react";
import { Input } from "../ui/input";
import {
  type PartnerGroup,
  type GroupVendor,
  GROUP_VENDORS,
} from "./partnerConstants";
import { getAvatarTint } from "../../utils/avatarTints";

// ── Step Tab ──
export function StepTab({
  stepNumber,
  label,
  shortLabel,
  isActive,
  isCompleted,
}: {
  stepNumber: number;
  label: string;
  shortLabel?: string;
  isActive: boolean;
  isCompleted: boolean;
}) {
  return (
    <div className={`relative flex items-center gap-2 px-0.5 pb-2.5 sm:pb-3 mr-5 sm:mr-7 cursor-default`}>
      {/* Circle indicator */}
      <div
        className={`w-5 h-5 sm:w-[22px] sm:h-[22px] rounded-full flex items-center justify-center text-[10px] sm:text-[11px] shrink-0 transition-all duration-200 ${
          isCompleted
            ? "bg-[#10B981] text-white shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
            : isActive
            ? "bg-[#0A77FF] text-white shadow-[0_0_0_2px_rgba(10,119,255,0.15)]"
            : "bg-[#EEF2F6] text-[#94A3B8]"
        }`}
        style={{ fontWeight: 700 }}
      >
        {isCompleted ? <Check className="w-3 h-3" /> : stepNumber}
      </div>
      {/* Label */}
      <span
        className={`text-xs sm:text-[13px] whitespace-nowrap transition-colors ${
          isCompleted
            ? "text-[#10B981]"
            : isActive
            ? "text-[#0F172A]"
            : "text-[#94A3B8]"
        }`}
        style={{ fontWeight: isActive || isCompleted ? 600 : 400 }}
      >
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel || label}</span>
      </span>
      {/* Active underline bar */}
      {(isActive || isCompleted) && (
        <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full transition-all ${
          isCompleted ? "bg-[#10B981]" : "bg-[#0A77FF]"
        }`} />
      )}
    </div>
  );
}

// ── Step 1: Partner Group Selection ──
export function Step1GroupSelection({
  search,
  onSearchChange,
  groups,
  selectedGroups,
  primaryGroupId,
  onSelectGroup,
  onSetPrimary,
}: {
  search: string;
  onSearchChange: (val: string) => void;
  groups: PartnerGroup[];
  selectedGroups: PartnerGroup[];
  primaryGroupId: string | null;
  onSelectGroup: (group: PartnerGroup) => void;
  onSetPrimary: (groupId: string) => void;
}) {
  const [quickViewGroup, setQuickViewGroup] = useState<PartnerGroup | null>(null);

  const handleOpenQuickView = useCallback((e: React.MouseEvent, group: PartnerGroup) => {
    e.stopPropagation();
    setQuickViewGroup(group);
  }, []);

  const selectedIds = useMemo(() => new Set(selectedGroups.map((g) => g.id)), [selectedGroups]);

  return (
    <div>
      {/* Sticky header: label + search + chips + results count */}
      <div className="sticky top-0 z-10 bg-[#FAFBFC] pb-2 -mx-3 sm:-mx-4 lg:-mx-5 px-3 sm:px-4 lg:px-5 pt-1">
        {/* Section label */}
        <div className="mb-2">
          <h4 className="text-[13px] sm:text-sm text-foreground" style={{ fontWeight: 600 }}>Select Partner Groups</h4>
          <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">
            Choose one or more partner groups. Mark one as primary to inherit its configuration.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            placeholder="Search partner groups..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-white border-[#E2E8F0] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 h-8 sm:h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selected chips */}
        {selectedGroups.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {selectedGroups.map((g) => {
              const isPrimary = g.id === primaryGroupId;
              return (
                <span
                  key={g.id}
                  className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[12px] border transition-colors ${
                    isPrimary
                      ? "bg-[#EDF4FF] text-[#0A77FF] border-[#0A77FF]/30"
                      : "bg-[#F8FAFC] text-[#334155] border-[#E2E8F0]"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {isPrimary && <Star className="w-3 h-3 fill-[#0A77FF] text-[#0A77FF]" />}
                  {g.name}
                  <button
                    onClick={() => onSelectGroup(g)}
                    className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Results count */}
        <p className="text-xs text-muted-foreground">
          {search.trim()
            ? `${groups.length} result${groups.length !== 1 ? "s" : ""} for "${search}"`
            : `${groups.length} group${groups.length !== 1 ? "s" : ""} available`}
        </p>

        {/* Bottom edge line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#E2E8F0]/60" />
      </div>

      {/* Scrollable grid area */}
      <div className="pt-2 relative z-0">
        <div
          className="grid gap-1.5 sm:gap-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          {groups.map((group) => {
            const isSelected = selectedIds.has(group.id);
            const isPrimary = group.id === primaryGroupId;
            return (
              <GroupCard
                key={group.id}
                group={group}
                isSelected={isSelected}
                isPrimary={isPrimary}
                searchQuery={search}
                onSelect={() => onSelectGroup(group)}
                onSetPrimary={() => onSetPrimary(group.id)}
                onQuickView={(e) => handleOpenQuickView(e, group)}
              />
            );
          })}
        </div>

        {groups.length === 0 && (
          <div className="py-10 sm:py-14 text-center">
            <div className="w-11 h-11 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-[#94A3B8]" />
            </div>
            <p className="text-[13px] text-[#334155]" style={{ fontWeight: 600 }}>No groups found</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Try adjusting your search terms.
            </p>
          </div>
        )}
      </div>

      {/* Quick View Overlay */}
      {quickViewGroup && (
        <GroupQuickViewOverlay
          group={quickViewGroup}
          onClose={() => setQuickViewGroup(null)}
        />
      )}
    </div>
  );
}

// ── Group Card with hover actions, multi-select checkmark, primary badge ──
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length === 0) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-[#FDE68A] text-inherit rounded-[2px] px-[1px]">{part}</mark>
    ) : (
      part
    )
  );
}

function GroupCard({
  group,
  isSelected,
  isPrimary,
  searchQuery,
  onSelect,
  onSetPrimary,
  onQuickView,
}: {
  group: PartnerGroup;
  isSelected: boolean;
  isPrimary: boolean;
  searchQuery?: string;
  onSelect: () => void;
  onSetPrimary: () => void;
  onQuickView: (e: React.MouseEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePrimaryClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelected) {
      onSelect();
      setTimeout(() => onSetPrimary(), 0);
    } else {
      onSetPrimary();
    }
  }, [isSelected, onSelect, onSetPrimary]);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative text-left p-2.5 sm:p-3 rounded-lg border transition-all duration-150"
      style={{
        borderColor: isSelected ? "#0A77FF" : isHovered ? "#CBD5E1" : "#E2E8F0",
        backgroundColor: isSelected ? "#F5F9FF" : isHovered ? "#FAFCFF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : isHovered
            ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
            : "none",
      }}
    >
      {/* Top-right actions row */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {isSelected && isHovered && (
          <>
            <div
              onClick={(e) => { e.stopPropagation(); onQuickView(e); }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-white/80 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
            </div>
            <div
              onClick={handlePrimaryClick}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isPrimary
                  ? "text-[#0A77FF] hover:bg-white/80"
                  : "text-[#94A3B8] hover:text-[#F59E0B] hover:bg-white/80"
              }`}
              title={isPrimary ? "Primary group" : "Set as primary"}
            >
              <Star className={`w-3.5 h-3.5 ${isPrimary ? "fill-[#0A77FF]" : ""}`} />
            </div>
          </>
        )}

        {!isSelected && isHovered && (
          <>
            <div
              onClick={(e) => { e.stopPropagation(); onQuickView(e); }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
            </div>
          </>
        )}

        {isPrimary && !isHovered && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#0A77FF] text-white text-[10px]" style={{ fontWeight: 600 }}>
            Primary
          </span>
        )}

        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {!isSelected && isHovered && (
          <div className="w-5 h-5 rounded-full border-2 border-[#CBD5E1] bg-white" />
        )}
      </div>

      {/* Icon */}
      <div className={`w-7 h-7 rounded-md flex items-center justify-center mb-1.5 transition-colors ${
        isSelected ? "bg-[#D6E8FF]" : "bg-[#F1F5F9]"
      }`}>
        <Building2 className={`w-4 h-4 transition-colors ${
          isSelected ? "text-primary" : "text-[#64748B]"
        }`} />
      </div>

      <p className="text-[13px] text-foreground pr-16 break-words" style={{ fontWeight: isSelected ? 600 : 500 }}>{highlightMatch(group.name, searchQuery || "")}</p>
      <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-2 pr-2 break-words">
        {highlightMatch(group.description, searchQuery || "")}
      </p>

      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-[#94A3B8]">
        <Users className="w-3 h-3" />
        <span>{group.memberCount} partner{group.memberCount !== 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}

// ── Quick View Overlay (Associated Vendors) ──
const STATUS_TABS = ["All", "Active", "Inactive"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const VENDOR_ROW_HEIGHT = 44;
const VENDOR_PAGE_SIZE = 50;

function GroupQuickViewOverlay({
  group,
  onClose,
}: {
  group: PartnerGroup;
  onClose: () => void;
}) {
  const allVendors = GROUP_VENDORS[group.id] || [];
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("All");
  const [visibleCount, setVisibleCount] = useState(VENDOR_PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allVendors.filter((v) => {
      if (statusTab !== "All" && v.status !== statusTab) return false;
      if (!q) return true;
      return (
        v.id.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q)
      );
    });
  }, [allVendors, search, statusTab]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      setVisibleCount((prev) => Math.min(prev + VENDOR_PAGE_SIZE, filtered.length));
    }
  }, [filtered.length]);

  useEffect(() => {
    setVisibleCount(VENDOR_PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [search, statusTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const statusStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    Active: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0", dot: "#059669" },
    Inactive: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", dot: "#D97706" },
  };

  const getStatusStyle = (status: GroupVendor["status"]) =>
    statusStyles[status] ?? statusStyles["Inactive"];

  const counts = useMemo(() => {
    const c = { All: allVendors.length, Active: 0, Inactive: 0 };
    for (const v of allVendors) c[v.status]++;
    return c;
  }, [allVendors]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50">
      <div
        ref={overlayRef}
        className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-[calc(100%-1rem)] sm:w-full max-w-[700px] max-h-[85vh] sm:max-h-[600px] flex flex-col animate-modal-pop mx-auto"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-sm text-[#0F172A] truncate" style={{ fontWeight: 600 }}>
                {group.name} — Associated Vendors
              </h3>
              <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">
                {allVendors.length} vendor{allVendors.length !== 1 ? "s" : ""} in this group
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-[#94A3B8]" />
            </button>
          </div>

          {/* Search + Status Tabs */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                readOnly
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData("text").trim();
                  if (text) setSearch(text);
                }}
                className="w-full h-8 pl-8 pr-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 focus:outline-none transition-colors cursor-default"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#E2E8F0] hover:bg-[#CBD5E1] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-2.5 h-2.5 text-[#64748B]" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusTab(tab)}
                  className={`px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
                    statusTab === tab
                      ? "bg-[#EDF4FF] text-[#0A77FF] border-[#ADD1FF]"
                      : "bg-[#F8FAFC] text-[#64748B] border-transparent hover:bg-[#F1F5F9]"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {tab}
                  <span className="ml-1 opacity-75">{counts[tab]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table header */}
        <div className="shrink-0 border-y border-[#EEF2F6] bg-[#FAFBFC] px-4 sm:px-5">
          <div className="grid grid-cols-[72px_1fr_72px] sm:grid-cols-[80px_1.2fr_1.5fr_76px] gap-2 h-8 items-center">
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider" style={{ fontWeight: 600 }}>ID</span>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider" style={{ fontWeight: 600 }}>Vendor Name</span>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider hidden sm:block" style={{ fontWeight: 600 }}>Address</span>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider text-right" style={{ fontWeight: 600 }}>Status</span>
          </div>
        </div>

        {/* Vendor list — scrollable */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto scrollbar-hide"
        >
          {visible.length > 0 ? (
            <div className="px-4 sm:px-5">
              {visible.map((vendor) => (
                <div
                  key={vendor.id}
                  className="grid grid-cols-[72px_1fr_72px] sm:grid-cols-[80px_1.2fr_1.5fr_76px] gap-2 items-center py-2.5 border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] transition-colors -mx-4 sm:-mx-5 px-4 sm:px-5"
                  style={{ minHeight: VENDOR_ROW_HEIGHT }}
                >
                  <span className="text-[11px] text-[#0A77FF] tabular-nums truncate" style={{ fontWeight: 600 }}>
                    {vendor.id}
                  </span>
                  <div className="min-w-0 flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px]"
                      style={{
                        fontWeight: 700,
                        backgroundColor: getAvatarTint(vendor.name).bg,
                        color: getAvatarTint(vendor.name).fg,
                      }}
                    >
                      {vendor.name.charAt(0)}
                    </div>
                    <span className="text-[12px] text-[#0F172A] truncate" style={{ fontWeight: 500 }}>
                      {vendor.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#64748B] truncate hidden sm:block">
                    {vendor.address}
                  </span>
                  <div className="flex justify-end">
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] shrink-0"
                      style={{
                        fontWeight: 500,
                        backgroundColor: getStatusStyle(vendor.status).bg,
                        color: getStatusStyle(vendor.status).text,
                        borderColor: getStatusStyle(vendor.status).border,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusStyle(vendor.status).dot }} />
                      {vendor.status}
                    </span>
                  </div>
                </div>
              ))}
              {visibleCount < filtered.length && (
                <div className="py-3 text-center">
                  <span className="text-[11px] text-[#94A3B8]">
                    Showing {visibleCount} of {filtered.length} — scroll for more
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-2.5">
                {search ? (
                  <Search className="w-5 h-5 text-[#94A3B8]" />
                ) : (
                  <Users className="w-5 h-5 text-[#94A3B8]" />
                )}
              </div>
              <p className="text-[13px] text-[#334155]" style={{ fontWeight: 600 }}>
                {search ? "No matching vendors" : "No vendors yet"}
              </p>
              <p className="text-xs text-[#94A3B8] mt-1">
                {search
                  ? "Try adjusting your search or filter."
                  : "This group doesn't have any associated vendors."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#EEF2F6] px-4 sm:px-5 py-2.5 flex items-center justify-between bg-[#FAFBFC] rounded-b-xl">
          <span className="text-[11px] text-[#94A3B8]">
            {filtered.length === allVendors.length
              ? `${allVendors.length} total`
              : `${filtered.length} of ${allVendors.length} shown`}
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
