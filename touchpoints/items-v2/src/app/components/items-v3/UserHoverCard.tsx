import * as React from "react";
import { Mail, Phone, Building2 } from "lucide-react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

/* ─── Tint palette (mirrors Partners getAvatarTint behaviour) ─── */
const USER_TINT_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: "#EBF3FF", fg: "#0A77FF" },
  { bg: "#F0EBFF", fg: "#6D28D9" },
  { bg: "#E8FAF3", fg: "#047857" },
  { bg: "#FEF5E7", fg: "#B45309" },
  { bg: "#FFE8EC", fg: "#BE185D" },
];

export function getUserTint(name: string): { bg: string; fg: string } {
  if (!name) return USER_TINT_PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
  return USER_TINT_PALETTE[Math.abs(h) % USER_TINT_PALETTE.length];
}

export function getUserInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Photo directory (mirrors Partners getPersonAvatar) ─── */
const PERSON_AVATARS: Record<string, string> = {
  Ahtisham: "https://randomuser.me/api/portraits/men/36.jpg",
  Maya: "https://randomuser.me/api/portraits/women/44.jpg",
  Liam: "https://randomuser.me/api/portraits/men/32.jpg",
  Sarah: "https://randomuser.me/api/portraits/women/65.jpg",
  Michael: "https://randomuser.me/api/portraits/men/75.jpg",
  Emily: "https://randomuser.me/api/portraits/women/28.jpg",
};

export function getPersonAvatar(name: string): string | undefined {
  if (!name) return undefined;
  const first = name.split(" ")[0];
  return PERSON_AVATARS[first];
}

/* ─── Curated user directory for Items users — full contact profiles ─── */
const USER_PROFILES: Record<
  string,
  { role: string; dept: string; email: string; phone: string }
> = {
  "Ahtisham Ahmad": {
    role: "Senior Procurement Lead",
    dept: "Procurement",
    email: "ahtisham.ahmad@company.com",
    phone: "(415) 882-1047",
  },
  "Maya Patel": {
    role: "Inventory Operations Manager",
    dept: "Operations",
    email: "maya.patel@company.com",
    phone: "(415) 553-2208",
  },
  "Liam Chen": {
    role: "Quality Assurance Lead",
    dept: "Quality Assurance",
    email: "liam.chen@company.com",
    phone: "(628) 412-7733",
  },
};

/* Deterministic fallback for unknown names — same hash strategy as Partners. */
function generateContactDetails(name: string) {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const depts = ["Procurement", "Supply Chain", "Finance", "Operations", "Sales", "Logistics", "Engineering", "Quality Assurance"];
  const roles = ["Manager", "Director", "Lead", "Specialist", "Coordinator", "Analyst", "Supervisor", "Associate"];
  const dept = depts[h % depts.length];
  const role = `${dept} ${roles[(h * 7) % roles.length]}`;
  const first = name.split(" ")[0]?.toLowerCase() || "user";
  const last = name.split(" ")[1]?.toLowerCase() || "user";
  const email = `${first}.${last}@company.com`;
  const phone = `(${300 + (h % 700)}) ${100 + (h % 900)}-${1000 + (h % 9000)}`;
  return { role, dept, email, phone };
}

export function getContactDetails(name: string) {
  return USER_PROFILES[name] ?? generateContactDetails(name);
}

/* ─── UserHoverCard — Partners-parity rich popover for user/POC cells ───
 * Matches VendorsListPage.tsx lines 2378-2396 literally:
 *   - 280px width, rounded-xl, dark gradient header w/ avatar + name + role
 *   - White body with Mail / Building2 / Phone contact rows
 */
export interface UserHoverCardProps {
  name: string;
  /** Optional short label shown when there's no role data (e.g. "Owner", "Created by"). */
  subtitle?: string;
  children: React.ReactNode;
}

export function UserHoverCard({ name, subtitle, children }: UserHoverCardProps) {
  if (!name) {
    return <>{children}</>;
  }
  const tint = getUserTint(name);
  const initials = getUserInitials(name);
  const photoUrl = getPersonAvatar(name);
  const cd = getContactDetails(name);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        {children as React.ReactElement}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Dark gradient header — mirrors Partners line 2379 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div
              className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0"
              style={{ backgroundColor: photoUrl ? "transparent" : tint.bg }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-[13px] text-white"
                  style={{ fontWeight: 700 }}
                >
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>
                {name}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {subtitle ?? cd.role}
              </p>
            </div>
          </div>
        </div>
        {/* Contact rows — mirrors Partners lines 2391-2395 */}
        <div className="bg-white px-4 py-3 space-y-2">
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{cd.email}</span>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{cd.dept}</span>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{cd.phone}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/* ─── UserCell — single shared renderer for Owner / Created By / any user column.
 * Circular avatar (photo if available, else colored initials), name with hover
 * underline, click opens the HoverCard (and stops row propagation so it does
 * NOT also trigger the row Quick View). Mirrors Partners' user cell visuals.
 */
export interface UserCellProps {
  name: string;
  subtitle?: string;
  /** "sm" = condensed (8x8), "md" = comfort (10x10) — matches OwnerCell sizing. */
  size?: "sm" | "md";
  /** Click handler — typically opens the User Detail Modal. Receives the user name. */
  onClick?: (name: string) => void;
}

export function UserCell({ name, subtitle, size = "sm", onClick }: UserCellProps) {
  /* Empty fallback — em-dash. */
  if (!name) {
    return <span className="text-muted-foreground">—</span>;
  }

  const tint = getUserTint(name);
  const initials = getUserInitials(name);
  const photoUrl = getPersonAvatar(name);
  const isMd = size === "md";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(name);
  };

  return (
    <UserHoverCard name={name} subtitle={subtitle}>
      <div
        className={`flex items-center ${isMd ? "gap-2.5" : "gap-2"} min-w-0 cursor-pointer group/u`}
        onClick={handleClick}
        role={onClick ? "button" : undefined}
      >
        <div
          className={`${isMd ? "w-10 h-10 text-[11px]" : "w-8 h-8 text-[10px]"} rounded-full flex items-center justify-center shrink-0 border border-[#E8ECF1] overflow-hidden`}
          style={{
            backgroundColor: photoUrl ? "transparent" : tint.bg,
            color: tint.fg,
            fontWeight: 700,
          }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <span
          className={`${isMd ? "text-[13.5px]" : "text-sm"} text-foreground truncate group-hover/u:text-primary group-hover/u:underline transition-colors`}
          style={{ fontWeight: isMd ? 500 : undefined }}
          title={name}
        >
          {name}
        </span>
      </div>
    </UserHoverCard>
  );
}
