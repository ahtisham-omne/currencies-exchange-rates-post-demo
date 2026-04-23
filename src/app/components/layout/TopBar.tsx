import React from "react";
import { Search, Plus } from "lucide-react";
import { FONT } from "../designTokens";
import { Avatar, AvatarFallback } from "../ui/avatar";

/* ── Props ── */

export interface TopBarProps {
  title: string;
  /** @deprecated kept for backward compatibility — no longer rendered */
  breadcrumbs?: { label: string; path?: string }[];
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
  showSearch = true,
  searchPlaceholder = "Search",
  showCreateButton = true,
  onCreateClick,
  actions,
  userName = "Areeb Tanvir",
  userInitials = "AT",
  userRole = "Product Designer",
}: TopBarProps) {
  return (
    <header
      className="flex h-12 w-full items-center justify-between border-b border-border px-6 shrink-0"
      style={{ backgroundColor: "var(--card)" }}
    >
      {/* ── Left: Title ── */}
      <div className="flex items-center gap-4 min-w-0">
        <span
          className="text-foreground truncate"
          style={{
            fontSize: "13px",
            fontWeight: "var(--font-weight-medium)",
            lineHeight: "19.5px",
            fontFamily: FONT,
          }}
        >
          {title}
        </span>
      </div>

      {/* ── Right: + Button, Search, User ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Quick create button */}
        {showCreateButton && (
          <button
            className="flex items-center justify-center size-8 rounded-[var(--radius-sm)] border border-border hover:bg-secondary transition-colors cursor-pointer"
            style={{ backgroundColor: "var(--secondary)" }}
            onClick={onCreateClick}
            aria-label="Quick create"
          >
            <Plus
              className="size-4 text-foreground"
              strokeWidth={1.33}
            />
          </button>
        )}

        {/* Search */}
        {showSearch && (
          <div className="relative hidden sm:block">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.33}
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="h-9 w-[200px] rounded-[var(--radius-sm)] border-none pl-9 pr-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/20 transition-all"
              style={{
                backgroundColor: "var(--secondary)",
                fontSize: "var(--text-label)",
                fontWeight: "var(--font-weight-normal)",
                fontFamily: FONT,
              }}
            />
          </div>
        )}

        {actions}

        {/* User avatar + name */}
        <div className="flex items-center gap-2 ml-2">
          <Avatar className="size-8 cursor-pointer">
            <AvatarFallback
              className="bg-primary/10 text-primary border border-primary/20"
              style={{
                fontSize: "11px",
                fontWeight: "var(--font-weight-semibold)",
                fontFamily: FONT,
              }}
            >
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col">
            <span
              className="text-foreground"
              style={{
                fontSize: "13px",
                fontWeight: "var(--font-weight-medium)",
                lineHeight: "19.5px",
                fontFamily: FONT,
              }}
            >
              {userName}
            </span>
            <span
              className="text-muted-foreground"
              style={{
                fontSize: "11px",
                fontWeight: "var(--font-weight-normal)",
                lineHeight: "13.75px",
                fontFamily: FONT,
              }}
            >
              {userRole}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}