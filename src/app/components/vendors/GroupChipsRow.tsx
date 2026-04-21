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
    <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60">
      {/* Dark gradient header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
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
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/25 text-[#60A5FA] shrink-0"
              style={{ fontWeight: 600 }}
            >
              <Star className="w-2.5 h-2.5 fill-[#60A5FA]" /> Primary
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 relative">
          {group.country} Region
        </p>
      </div>
      {/* Body */}
      <div className="bg-white px-3.5 py-3 space-y-3">
        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
          {group.description}
        </p>
        <div className="flex items-center gap-4 pt-2 border-t border-muted">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Users className="w-3 h-3 text-slate-400" />
            <span style={{ fontWeight: 500 }}>{group.memberCount} partners</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Globe className="w-3 h-3 text-slate-400" />
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
            ? "bg-accent text-primary border-primary/25"
            : "bg-slate-50 text-muted-foreground border-border hover:border-slate-300 hover:bg-muted"
        }`}
        style={{ fontWeight: 500 }}
      >
        {isPrimary && (
          <Star className="w-2.5 h-2.5 fill-primary text-primary" />
        )}
        {group.countryFlag} {group.name}
        <span
          className="text-[10px] text-slate-400"
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
        className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] border border-border bg-slate-50 text-slate-500 hover:bg-muted hover:text-muted-foreground hover:border-slate-300 transition-colors cursor-default shrink-0"
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
          <div className="w-[240px] rounded-xl border border-border/60 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-muted bg-[#FAFBFC]">
              <span
                className="text-[11px] text-slate-500"
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
                      isHovered ? "bg-accent" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="shrink-0">{g.countryFlag}</span>
                    <span
                      className={`text-[12px] truncate ${
                        isHovered ? "text-primary" : "text-slate-700"
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {g.name}
                    </span>
                    {isPrimary && (
                      <Star className="w-2.5 h-2.5 fill-primary text-primary shrink-0" />
                    )}
                    <span className="text-[10px] text-slate-400 ml-auto shrink-0">
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