import React from "react";
import { Search, Plus } from "lucide-react";
import { FONT } from "../designTokens";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/* ── Types ── */

export interface BreadcrumbSegment {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface TopBarProps {
  /** Page title — rendered as single breadcrumb segment if `breadcrumbs` is empty */
  title?: string;
  /** Breadcrumb trail. Last segment renders as foreground; preceding segments render as muted with `/` separators. */
  breadcrumbs?: BreadcrumbSegment[];
  showSearch?: boolean;
  searchPlaceholder?: string;
  /** Show the + quick-create button */
  showCreateButton?: boolean;
  createPath?: string;
  onCreateClick?: () => void;
  actions?: React.ReactNode;
  userName?: string;
  userInitials?: string;
  userRole?: string;
}

/* ── Component ── */

export default function TopBar({
  title,
  breadcrumbs,
  showSearch = true,
  searchPlaceholder = "Search...",
  showCreateButton = true,
  onCreateClick,
  actions,
  userName = "Areeb Tanvir",
  userInitials = "AT",
  userRole = "Product Designer",
}: TopBarProps) {
  const segments: BreadcrumbSegment[] =
    breadcrumbs && breadcrumbs.length > 0
      ? breadcrumbs
      : title
      ? [{ label: title }]
      : [];

  return (
    <header className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
      {/* ── Left: Breadcrumbs ── */}
      <div
        className="flex items-center gap-2 text-[13px] text-muted-foreground min-w-0"
        style={{ fontFamily: FONT }}
      >
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const isLink = !isLast && (seg.href || seg.onClick);
          return (
            <React.Fragment key={`${seg.label}-${i}`}>
              {i > 0 && <span className="text-muted-foreground/60">/</span>}
              {isLink ? (
                <button
                  type="button"
                  onClick={seg.onClick}
                  className="hover:text-foreground transition-colors cursor-pointer truncate"
                  style={{ fontWeight: 500 }}
                >
                  {seg.label}
                </button>
              ) : (
                <span
                  className={isLast ? "text-foreground truncate" : "truncate"}
                  style={{ fontWeight: 500 }}
                >
                  {seg.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Right: + Button, Search, User ── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Quick create button */}
        {showCreateButton && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onCreateClick}
            aria-label="Quick create"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}

        {/* Search */}
        {showSearch && (
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-9 w-[260px] h-8 bg-white border-border/60 text-[13px] placeholder:text-muted-foreground/50"
            />
          </div>
        )}

        {actions}

        {/* User avatar + name */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "hsl(var(--accent))" }}
          >
            <span
              className="text-[11px]"
              style={{ fontWeight: 600, color: "hsl(var(--primary))", fontFamily: FONT }}
            >
              {userInitials}
            </span>
          </div>
          <div className="hidden sm:block">
            <p
              className="text-[13px]"
              style={{ fontWeight: 500, fontFamily: FONT }}
            >
              {userName}
            </p>
            <p
              className="text-[11px] text-muted-foreground leading-tight"
              style={{ fontFamily: FONT }}
            >
              {userRole}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
