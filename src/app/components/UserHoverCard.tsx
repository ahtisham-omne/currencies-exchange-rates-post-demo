import React from "react";
import { Mail, ExternalLink } from "lucide-react";
import { FONT } from "./designTokens";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "./ui/hover-card";

/* ═══════════════════════════════════════════════════════════════
   INTERNAL USERS DIRECTORY
   ═══════════════════════════════════════════════════════════════ */

export interface InternalUser {
  name: string;
  initials: string;
  designation: string;
  department: string;
  email: string;
}

const INTERNAL_USERS: Record<string, InternalUser> = {
  "Areeb Tanvir": {
    name: "Areeb Tanvir",
    initials: "AT",
    designation: "Product Designer",
    department: "Supply Chain",
    email: "areeb.tanvir@omne.com",
  },
  "Nophil Anwer": {
    name: "Nophil Anwer",
    initials: "NA",
    designation: "Engineering Lead",
    department: "Supply Chain",
    email: "nophil.anwer@omne.com",
  },
  "Shehryar Hasan": {
    name: "Shehryar Hasan",
    initials: "SH",
    designation: "Procurement Officer",
    department: "Purchasing",
    email: "shehryar.hasan@omne.com",
  },
  "Eli Rosenbloom": {
    name: "Eli Rosenbloom",
    initials: "ER",
    designation: "Product Owner",
    department: "Operations",
    email: "eli.rosenbloom@omne.com",
  },
  "Irtaza Abid": {
    name: "Irtaza Abid",
    initials: "IA",
    designation: "Supply Chain Analyst",
    department: "Supply Chain",
    email: "irtaza.abid@omne.com",
  },
};

/** Check if a name belongs to an internal user */
export function isInternalUser(name: string): boolean {
  return name in INTERNAL_USERS;
}

/** Get internal user data by name */
export function getInternalUser(name: string): InternalUser | null {
  return INTERNAL_USERS[name] ?? null;
}

/* ═══════════════════════════════════════════════════════════════
   AVATAR COLORS (shared with other components)
   ═══════════════════════════════════════════════════════════════ */

const AVATAR_BG = [
  "var(--avatar-1-bg)", "var(--avatar-3-bg)", "var(--avatar-4-bg)",
  "var(--avatar-2-bg)", "var(--avatar-5-bg)", "var(--avatar-6-bg)", "var(--avatar-7-bg)",
];
const AVATAR_TEXT = [
  "var(--avatar-1-text)", "var(--avatar-3-text)", "var(--avatar-4-text)",
  "var(--avatar-2-text)", "var(--avatar-5-text)", "var(--avatar-6-text)", "var(--avatar-7-text)",
];

function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % AVATAR_BG.length;
}

/* ═══════════════════════════════════════════════════════════════
   USER HOVER CARD
   ═══════════════════════════════════════════════════════════════ */

interface UserHoverCardProps {
  name: string;
  children: React.ReactNode;
}

export default function UserHoverCard({ name, children }: UserHoverCardProps) {
  const user = getInternalUser(name);
  if (!user) {
    return <>{children}</>;
  }

  const ci = getColorIndex(name);

  return (
    <HoverCard openDelay={300} closeDelay={200}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[260px] p-4 bg-popover border border-border shadow-lg rounded-lg z-[200] animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
      >
        <div className="flex flex-col gap-3" style={{ fontFamily: FONT }}>
          {/* Avatar + Name */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center size-11 rounded-full shrink-0"
              style={{ backgroundColor: AVATAR_BG[ci] }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: FONT,
                  color: AVATAR_TEXT[ci],
                }}
              >
                {user.initials}
              </span>
            </div>
            <div className="min-w-0">
              <div
                className="text-foreground truncate"
                style={{ fontSize: "14px", fontWeight: 600, lineHeight: "1.3", fontFamily: FONT }}
              >
                {user.name}
              </div>
              <div
                className="text-muted-foreground truncate"
                style={{ fontSize: "12px", fontWeight: 400, lineHeight: "1.3", fontFamily: FONT }}
              >
                {user.designation}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
            <div className="flex items-center gap-2">
              <span
                className="text-muted-foreground/60"
                style={{ fontSize: "11px", fontWeight: 500, fontFamily: FONT, minWidth: "68px" }}
              >
                Department
              </span>
              <span
                className="text-foreground"
                style={{ fontSize: "12px", fontWeight: 500, fontFamily: FONT }}
              >
                {user.department}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-muted-foreground/60"
                style={{ fontSize: "11px", fontWeight: 500, fontFamily: FONT, minWidth: "68px" }}
              >
                Email
              </span>
              <a
                href={`mailto:${user.email}`}
                className="text-primary hover:underline truncate"
                style={{ fontSize: "12px", fontWeight: 500, fontFamily: FONT }}
                onClick={(e) => e.stopPropagation()}
              >
                {user.email}
              </a>
            </div>
          </div>

          {/* View Profile link */}
          <button
            className="flex items-center justify-center gap-1.5 w-full h-7 rounded-[var(--radius-sm)] border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            style={{ fontSize: "11px", fontWeight: 500, fontFamily: FONT }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3" />
            View Profile
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
