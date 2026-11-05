import React, { useState, useRef, useCallback } from "react";
import { Star, Package, Tags } from "lucide-react";
import { X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";

// ── Category type used by the chip row ──
export interface CategoryChipData {
  id: string;
  name: string;
  description?: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

const CATEGORY_MAX_VISIBLE = 3;

// ── Quick View Card for a Category ──
function CategoryQuickViewCard({
  category,
  isPrimary,
}: {
  category: CategoryChipData;
  isPrimary: boolean;
}) {
  const Icon = category.icon || Package;
  return (
    <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60">
      {/* Dark gradient header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-4 h-4 text-slate-300 shrink-0" />
            <span
              className="text-white text-[13px] truncate"
              style={{ fontWeight: 600 }}
            >
              {category.name}
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
      </div>
      {/* Body */}
      <div className="bg-white px-3.5 py-3 space-y-3">
        {category.description && (
          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
            {category.description}
          </p>
        )}
        <div className="flex items-center gap-4 pt-2 border-t border-muted">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Tags className="w-3 h-3 text-slate-400" />
            <span style={{ fontWeight: 500 }}>
              {typeof category.count === "number" ? `${category.count} items` : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hoverable Category Chip with Quick View Popover + remove ──
function CategoryChipWithPopover({
  category,
  isPrimary,
  onRemove,
}: {
  category: CategoryChipData;
  isPrimary: boolean;
  onRemove: (category: CategoryChipData) => void;
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
      <PopoverTrigger asChild>
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[11px] border transition-colors cursor-default shrink-0 ${
            isPrimary
              ? "bg-accent text-primary border-primary/25"
              : "bg-slate-50 text-muted-foreground border-border hover:border-slate-300 hover:bg-muted"
          }`}
          style={{ fontWeight: 500 }}
        >
          {isPrimary && (
            <Star className="w-2.5 h-2.5 fill-primary text-primary" />
          )}
          {category.name}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(category); }}
            className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors ml-0.5 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
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
        <CategoryQuickViewCard category={category} isPrimary={isPrimary} />
      </PopoverContent>
    </Popover>
  );
}

// ── Overflow "+X more" Popover with hover-to-detail and per-row remove ──
function CategoryOverflowChip({
  overflowCategories,
  primaryCategoryId,
  onRemove,
}: {
  overflowCategories: CategoryChipData[];
  primaryCategoryId: string | null;
  onRemove: (category: CategoryChipData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<CategoryChipData | null>(null);
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
      setHoveredCategory(null);
    }, 200);
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setOpen(false);
          setHoveredCategory(null);
        }
      }}
    >
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] border border-border bg-slate-50 text-slate-500 hover:bg-muted hover:text-muted-foreground hover:border-slate-300 transition-colors cursor-default shrink-0"
        style={{ fontWeight: 500 }}
      >
        +{overflowCategories.length} more
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
                +{overflowCategories.length} more categor
                {overflowCategories.length !== 1 ? "ies" : "y"}
              </span>
            </div>
            <div className="max-h-[220px] overflow-y-auto py-1">
              {overflowCategories.map((c) => {
                const isPrimary = c.id === primaryCategoryId;
                const isHovered = hoveredCategory?.id === c.id;
                const Icon = c.icon || Package;
                return (
                  <div
                    key={c.id}
                    onMouseEnter={() => setHoveredCategory(c)}
                    className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left cursor-default ${
                      isHovered ? "bg-accent" : "hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-3 h-3 text-slate-400 shrink-0" />
                    <span
                      className={`text-[12px] truncate ${
                        isHovered ? "text-primary" : "text-slate-700"
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {c.name}
                    </span>
                    {isPrimary && (
                      <Star className="w-2.5 h-2.5 fill-primary text-primary shrink-0" />
                    )}
                    {typeof c.count === "number" && (
                      <span className="text-[10px] text-slate-400 ml-auto shrink-0">
                        {c.count}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(c); }}
                      className={`w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors shrink-0 cursor-pointer ${typeof c.count === "number" ? "" : "ml-auto"}`}
                    >
                      <X className="w-2.5 h-2.5 text-slate-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Quick view panel — appears on row hover */}
          {hoveredCategory && (
            <div
              className="shrink-0 animate-in fade-in-0 slide-in-from-left-2 duration-150"
            >
              <CategoryQuickViewCard
                category={hoveredCategory}
                isPrimary={hoveredCategory.id === primaryCategoryId}
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main CategoryChipsRow Component ──
export function CategoryChipsRow({
  selectedCategories,
  primaryCategoryId,
  onRemove,
}: {
  selectedCategories: CategoryChipData[];
  primaryCategoryId: string | null;
  onRemove: (category: CategoryChipData) => void;
}) {
  // Always float the primary category to the front — no matter when it was
  // selected — so it reads first and never gets buried in the "+N more" overflow.
  const ordered = primaryCategoryId
    ? [
        ...selectedCategories.filter((c) => c.id === primaryCategoryId),
        ...selectedCategories.filter((c) => c.id !== primaryCategoryId),
      ]
    : selectedCategories;
  const visibleCategories = ordered.slice(0, CATEGORY_MAX_VISIBLE);
  const overflowCategories = ordered.slice(CATEGORY_MAX_VISIBLE);

  return (
    <div className="flex items-center gap-1.5 mb-2 min-w-0 overflow-x-auto">
      {visibleCategories.map((c) => (
        <CategoryChipWithPopover
          key={c.id}
          category={c}
          isPrimary={c.id === primaryCategoryId}
          onRemove={onRemove}
        />
      ))}
      {overflowCategories.length > 0 && (
        <CategoryOverflowChip
          overflowCategories={overflowCategories}
          primaryCategoryId={primaryCategoryId}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}