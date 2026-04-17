import React, { useState, useRef, useCallback } from "react";
import { Star, Users, Globe } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import type { PartnerGroup } from "./partnerConstants";

const MAX_VISIBLE_CHIPS = 3;

// ── Quick View Card for a Partner Group ──
function GroupQuickViewCard({
  group,
  isPrimary,
}: {
  group: PartnerGroup;
  isPrimary: boolean;
}) {
  return (
    <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E2E8F0]/60">
      {/* Dark gradient header */}
      <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] px-3.5 py-3 relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">{group.countryFlag}</span>
            <span
              className="text-white text-[13px] truncate"
              style={{ fontWeight: 600 }}
            >
              {group.name}
            </span>
          </div>
          {isPrimary && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#0A77FF]/25 text-[#60A5FA] shrink-0"
              style={{ fontWeight: 600 }}
            >
              <Star className="w-2.5 h-2.5 fill-[#60A5FA]" /> Primary
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#94A3B8] mt-1.5 relative">
          {group.country} Region
        </p>
      </div>
      {/* Body */}
      <div className="bg-white px-3.5 py-3 space-y-3">
        <p className="text-[12px] text-[#475569] leading-relaxed line-clamp-3">
          {group.description}
        </p>
        <div className="flex items-center gap-4 pt-2 border-t border-[#F1F5F9]">
          <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
            <Users className="w-3 h-3 text-[#94A3B8]" />
            <span style={{ fontWeight: 500 }}>{group.memberCount} partners</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
            <Globe className="w-3 h-3 text-[#94A3B8]" />
            <span style={{ fontWeight: 500 }}>{group.country}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hoverable Group Chip with Quick View Popover ──
function GroupChipWithPopover({
  group,
  isPrimary,
}: {
  group: PartnerGroup;
  isPrimary: boolean;
}) {
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border transition-colors cursor-default shrink-0 ${
          isPrimary
            ? "bg-[#EDF4FF] text-[#0A77FF] border-[#0A77FF]/25"
            : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F1F5F9]"
        }`}
        style={{ fontWeight: 500 }}
      >
        {isPrimary && (
          <Star className="w-2.5 h-2.5 fill-[#0A77FF] text-[#0A77FF]" />
        )}
        {group.countryFlag} {group.name}
        <span
          className="text-[10px] text-[#94A3B8]"
          style={{ fontWeight: 400 }}
        >
          · {group.memberCount}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <GroupQuickViewCard group={group} isPrimary={isPrimary} />
      </PopoverContent>
    </Popover>
  );
}

// ── Overflow "+X more" Popover with hover-to-detail ──
function OverflowChip({
  overflowGroups,
  primaryGroupId,
}: {
  overflowGroups: PartnerGroup[];
  primaryGroupId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<PartnerGroup | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => {
      setOpen(false);
      setHoveredGroup(null);
    }, 200);
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setOpen(false);
          setHoveredGroup(null);
        }
      }}
    >
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#475569] hover:border-[#CBD5E1] transition-colors cursor-default shrink-0"
        style={{ fontWeight: 500 }}
      >
        +{overflowGroups.length} more
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-start gap-2">
          {/* List panel */}
          <div className="w-[240px] rounded-xl border border-[#E2E8F0]/60 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC]">
              <span
                className="text-[11px] text-[#64748B]"
                style={{ fontWeight: 600 }}
              >
                +{overflowGroups.length} more group
                {overflowGroups.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-[220px] overflow-y-auto py-1">
              {overflowGroups.map((g) => {
                const isPrimary = g.id === primaryGroupId;
                const isHovered = hoveredGroup?.id === g.id;
                return (
                  <div
                    key={g.id}
                    onMouseEnter={() => setHoveredGroup(g)}
                    className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left cursor-default ${
                      isHovered ? "bg-[#EDF4FF]" : "hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <span className="shrink-0">{g.countryFlag}</span>
                    <span
                      className={`text-[12px] truncate ${
                        isHovered ? "text-[#0A77FF]" : "text-[#334155]"
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {g.name}
                    </span>
                    {isPrimary && (
                      <Star className="w-2.5 h-2.5 fill-[#0A77FF] text-[#0A77FF] shrink-0" />
                    )}
                    <span className="text-[10px] text-[#94A3B8] ml-auto shrink-0">
                      {g.memberCount}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Quick view panel — appears on row hover */}
          {hoveredGroup && (
            <div
              className="shrink-0 animate-in fade-in-0 slide-in-from-left-2 duration-150"
              onMouseEnter={() => {
                /* keep hoveredGroup alive while cursor is on card */
              }}
            >
              <GroupQuickViewCard
                group={hoveredGroup}
                isPrimary={hoveredGroup.id === primaryGroupId}
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main GroupChipsRow Component ──
function GroupChipsRow({
  allSelectedGroups,
  primaryGroupId,
}: {
  allSelectedGroups: PartnerGroup[];
  primaryGroupId: string | null;
}) {
  const visibleGroups = allSelectedGroups.slice(0, MAX_VISIBLE_CHIPS);
  const overflowGroups = allSelectedGroups.slice(MAX_VISIBLE_CHIPS);

  return (
    <div className="px-2.5 sm:px-3 pb-2 flex items-center gap-1.5 min-w-0">
      {visibleGroups.map((g) => (
        <GroupChipWithPopover
          key={g.id}
          group={g}
          isPrimary={g.id === primaryGroupId}
        />
      ))}
      {overflowGroups.length > 0 && (
        <OverflowChip
          overflowGroups={overflowGroups}
          primaryGroupId={primaryGroupId}
        />
      )}
    </div>
  );
}

export { GroupChipsRow };