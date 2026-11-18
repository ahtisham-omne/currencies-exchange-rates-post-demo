import {
  Check,
  ExternalLink,
  EyeOff,
  LifeBuoy,
  LogOut,
  MousePointerClick,
  Palette,
  ShieldCheck,
  Table2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "./ui/utils";
import { CURRENT_USER } from "../data/current-user";
import { isNewTenant } from "../data/tenant";
import { getAccountOwnerIds, isAccountOwner } from "../data/account-owner";
import {
  getViewerProfile,
  setViewerId,
  useViewer,
  type ViewerProfile,
} from "../data/viewer";
import { getInitials, resolveUserAvatar } from "../lib/avatar";
import {
  ACCESS_LEVELS,
  setAccessLevel,
  setDenialStyle,
  useAccessMode,
  useDenialStyle,
  type DenialStyle,
} from "./access-mode";

/* Header user menu — a real profile menu whose lower half carries the
 * prototype's access controls.
 *
 * Shape and metrics mirror the Alerts module's header menu
 * (alert-settings `shell/UserMenu.tsx`): identity block, plain profile rows,
 * then an amber caveat introducing the exploration surfaces below it. The
 * brand blue is UAC's own #007FFF rather than that repo's #0A77FF so the
 * header carries one blue.
 *
 * Under the caveat sit four identically-shaped icon-tile rows — the same row
 * as that menu's "Email templates" entry:
 *   · Signed in as     — a flyout of people to view the prototype as: the
 *                        default admin persona plus every Account Owner, for
 *                        the rules only an owner signed in as themselves can
 *                        exercise (UAC Spec, Roles, Section 11).
 *   · Access level     — a flyout of the levels; picking one re-derives every
 *                        capability boolean and re-renders every gated surface.
 *   · Denied actions   — a flyout choosing whether a denied affordance
 *                        disappears or stays visible but inert.
 *   · Capability matrix — the model's own documentation.
 * The first three carry their current value on the row's description line, so
 * the selection is readable without opening the flyout. */

const BRAND = "#007FFF";

const DENIAL_OPTIONS: {
  id: DenialStyle;
  icon: LucideIcon;
  name: string;
  subtext: string;
}[] = [
  {
    id: "hidden",
    icon: EyeOff,
    name: "Hide the action",
    subtext: "Denied affordances leave no trace",
  },
  {
    id: "disabled",
    icon: MousePointerClick,
    name: "Show it disabled",
    subtext: "Dimmed and inert, with a reason",
  },
];

/* Plain profile row: sentence-case label + leading icon, blue-shade hover
 * (Radix highlights via focus). No dividers between rows. */
const ROW =
  "cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-[#0F172A] hover:bg-[#EDF4FF] focus:bg-[#EDF4FF] hover:text-[#007FFF] focus:text-[#007FFF] [&:hover_svg]:text-[#007FFF] [&:focus_svg]:text-[#007FFF]";

/* The icon-tile row shared by all three access entries. */
const TILE_ROW =
  "group cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 outline-none focus-visible:outline-none focus:bg-blue-50 data-[highlighted]:bg-blue-50";
const TILE =
  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#F8FAFC] border border-[#F1F5F9] group-data-[highlighted]:bg-white group-data-[highlighted]:border-[#DBEAFE]";

/* Flyout that opens beside a tile row. */
const FLYOUT = "rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-lg";

/* The caveat is tied to the rows below it with aria-labelledby, so a screen
 * reader reads it as their group label rather than dropping it as a stray
 * line of text between menu items. */
const EXPLORATION_LABEL_ID = "user-menu-exploration-caveat";

/** Title + description body shared by every icon-tile row. */
function TileBody({ label, description }: { label: string; description: string }) {
  return (
    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
      <span
        className="truncate"
        style={{ fontSize: "13px", fontWeight: 500, lineHeight: "18px", color: "#0F172A" }}
      >
        {label}
      </span>
      <span
        className="truncate text-[#64748B]"
        style={{ fontSize: "12px", lineHeight: "16px", fontWeight: 400 }}
      >
        {description}
      </span>
    </span>
  );
}

/** One option inside a flyout: title (bold when active), a muted description
 *  line, and a check on the active row. */
function FlyoutRow({
  active,
  icon: Icon,
  label,
  description,
  onSelect,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem className={ROW} onSelect={onSelect}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: active ? BRAND : "#64748B" }} />
      <span className="flex-1 min-w-0 flex flex-col">
        <span style={{ fontWeight: active ? 600 : 500 }}>{label}</span>
        <span className="text-[11px] text-[#94A3B8]">{description}</span>
      </span>
      {active && <Check className="w-4 h-4 shrink-0" style={{ color: BRAND }} />}
    </DropdownMenuItem>
  );
}

/** The signed-in viewer's avatar: their directory photo when they have one
 *  (the Account Owners do), otherwise the tinted initials disc the header
 *  trigger has always drawn for the admin persona, at any diameter. */
function Avatar({ size, viewer }: { size: number; viewer: ViewerProfile }) {
  const photo = resolveUserAvatar({ userId: viewer.id });
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        aria-hidden="true"
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: "#EDF4FF" }}
    >
      <span
        style={{ fontSize: Math.round(size * 0.34), fontWeight: 600, color: BRAND }}
      >
        {getInitials(viewer.name)}
      </span>
    </span>
  );
}

/** Who the prototype can be viewed as: the admin persona, then every Account
 *  Owner. The current viewer stays listed even after leaving the role.
 *
 *  After an onboarding hand-off the first entry is the person from Home
 *  instead, who may hold the Account Owner role too, hence the Set; their line
 *  is their first role, as the hand-off set it (onboarding-handoff.ts). */
function viewerOptions(currentId: number) {
  const ids = [...new Set([CURRENT_USER.id, ...getAccountOwnerIds()])];
  if (!ids.includes(currentId)) ids.push(currentId);
  return ids.map((id) => {
    const owner = isAccountOwner(id);
    const roleLine = isNewTenant() && id === CURRENT_USER.id ? CURRENT_USER.jobTitle : "";
    return {
      profile: getViewerProfile(id),
      icon: owner ? ShieldCheck : UserRound,
      description: owner ? "Account Owner" : roleLine || "Administrator, not an Account Owner",
      owner,
    };
  });
}

export function AccessSwitcher() {
  const active = useAccessMode();
  const denial = useDenialStyle();
  const navigate = useNavigate();
  const viewer = useViewer();

  /* A restricted level is easy to forget you selected, so the trigger carries a
   * tinted chip naming it (the same "you can never forget you are
   * impersonating" treatment the Cycle Count switcher uses). All Access is the
   * default, so it shows the plain avatar with no chip. */
  const restricted = active.level !== "all";
  /* Signing in as someone else keeps the header container as it is; only the
   * avatar's picture changes to that person, which is the indication. */
  const showChip = restricted;
  const chipLabel = active.label;
  const ChipIcon = active.icon;
  const ActiveIcon = active.icon;
  const activeDenial = DENIAL_OPTIONS.find((o) => o.id === denial) ?? DENIAL_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`User menu. Signed in as ${viewer.name}. Access level: ${active.label}`}
          className={cn(
            "flex items-center shrink-0 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007FFF]/30",
            showChip
              ? "gap-1.5 h-8 pl-2 pr-1.5 rounded-full border border-[#BFDBFE] bg-[#EDF4FF] hover:bg-[#DBEAFE]"
              : "w-8 h-8 rounded-full justify-center hover:ring-2 hover:ring-[#007FFF]/20",
          )}
        >
          {showChip && (
            <>
              <ChipIcon className="w-3.5 h-3.5 shrink-0" style={{ color: BRAND }} />
              <span
                className="whitespace-nowrap"
                style={{ fontSize: "12px", fontWeight: 600, color: BRAND }}
              >
                {chipLabel}
              </span>
            </>
          )}
          {/* White inner disc against the tinted chip, the usual #EDF4FF tint
              when standing alone as the plain header avatar. A viewer with a
              directory photo shows the photo instead. */}
          {resolveUserAvatar({ userId: viewer.id }) ? (
            <Avatar size={showChip ? 22 : 32} viewer={viewer} />
          ) : (
            <span
              className="rounded-full flex items-center justify-center shrink-0"
              style={{
                width: showChip ? 22 : 32,
                height: showChip ? 22 : 32,
                backgroundColor: showChip ? "#FFFFFF" : "#EDF4FF",
              }}
            >
              <span
                style={{
                  fontSize: showChip ? 8.5 : 11,
                  fontWeight: 600,
                  color: BRAND,
                }}
              >
                {getInitials(viewer.name)}
              </span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[272px] rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.14),0_2px_6px_rgba(15,23,42,0.05)]"
      >
        {/* Identity block — subtle glassy blue gradient. */}
        <div
          className="flex flex-col items-center text-center px-3 pt-4 pb-4 mb-1 rounded-lg border"
          style={{
            background: "linear-gradient(178deg, #FDFEFF 0%, #F8FAFD 50%, #F1F5FA 100%)",
            borderColor: "#EAEFF6",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          <Avatar size={64} viewer={viewer} />
          <p className="mt-2.5 text-[14px] text-[#0F172A]" style={{ fontWeight: 600 }}>
            {viewer.name}
          </p>
          <p className="mt-0.5 text-[12px] text-[#64748B] truncate max-w-full">
            {viewer.email}
          </p>
        </div>

        <DropdownMenuItem className={ROW} onSelect={() => toast.success("Coming soon")}>
          <UserRound className="w-4 h-4 text-[#64748B]" />
          Edit profile
        </DropdownMenuItem>

        <DropdownMenuItem className={ROW} onSelect={() => toast.success("Coming soon")}>
          <Palette className="w-4 h-4 text-[#64748B]" />
          Change theme
        </DropdownMenuItem>

        <DropdownMenuItem className={ROW}>
          <LifeBuoy className="w-4 h-4 text-[#64748B]" />
          Help and support
          <ExternalLink className="w-3.5 h-3.5 text-[#94A3B8] ml-auto" />
        </DropdownMenuItem>

        <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#DC2626] focus:bg-[#FEF2F2] focus:text-[#DC2626]">
          <LogOut className="w-4 h-4 text-[#DC2626]" />
          Log out
        </DropdownMenuItem>

        {/* Prototype access tooling. Nothing below is a screen anyone is meant
            to build — the caveat says so, because a reviewer arriving here cold
            would otherwise read the access switcher as product scope. */}
        <div aria-hidden="true" className="my-1.5 -mx-1.5 h-px bg-[#F1F5F9]" />
        <p
          id={EXPLORATION_LABEL_ID}
          className="mt-1 mb-1.5 rounded-md border px-2.5 py-1.5 text-[11px] leading-[15px] text-[#B45309]"
          /* Balanced, or the line breaks a couple of words short and leaves
             the second sentence stranded on its own. */
          style={{ background: "#FFFBEB", borderColor: "#FDE68A", textWrap: "balance" }}
        >
          <span className="text-[#92400E]" style={{ fontWeight: 600 }}>
            Experimental Designs.
          </span>{" "}
          Please do not use.
        </p>

        <DropdownMenuGroup aria-labelledby={EXPLORATION_LABEL_ID}>
          {/* Signed in as — who the prototype is viewed as. Picking an Account
              Owner also selects All Access, because the role holds every
              permission. */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={`${TILE_ROW} data-[state=open]:bg-blue-50`}
            >
              <span
                className={`${TILE} group-data-[state=open]:bg-white group-data-[state=open]:border-[#DBEAFE]`}
              >
                <UserRound className="w-4 h-4 text-[#64748B] group-data-[highlighted]:text-[#007FFF] group-data-[state=open]:text-[#007FFF]" />
              </span>
              <TileBody label="Signed in as" description={viewer.name} />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={10} className={`${FLYOUT} w-[272px]`}>
              {viewerOptions(viewer.id).map((opt) => (
                <FlyoutRow
                  key={opt.profile.id}
                  active={opt.profile.id === viewer.id}
                  icon={opt.icon}
                  label={opt.profile.name}
                  description={opt.description}
                  onSelect={() => {
                    setViewerId(opt.profile.id);
                    if (opt.owner) setAccessLevel("all");
                  }}
                />
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Access level — the levels themselves live one layer down, so the
              menu opens at a readable height and the three entries read as
              siblings. The row's description names the active level. */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={`${TILE_ROW} data-[state=open]:bg-blue-50`}
            >
              <span
                className={`${TILE} group-data-[state=open]:bg-white group-data-[state=open]:border-[#DBEAFE]`}
              >
                <ActiveIcon className="w-4 h-4 text-[#64748B] group-data-[highlighted]:text-[#007FFF] group-data-[state=open]:text-[#007FFF]" />
              </span>
              <TileBody label="Access level" description={active.label} />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={10} className={`${FLYOUT} w-[272px]`}>
              {ACCESS_LEVELS.map((l) => (
                <FlyoutRow
                  key={l.level}
                  active={l.level === active.level}
                  icon={l.icon}
                  label={l.label}
                  description={l.description}
                  onSelect={() => setAccessLevel(l.level)}
                />
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Degradation strategy — whether a capability-denied action
              disappears or stays visible but inert. */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={`${TILE_ROW} data-[state=open]:bg-blue-50`}
            >
              <span
                className={`${TILE} group-data-[state=open]:bg-white group-data-[state=open]:border-[#DBEAFE]`}
              >
                <ShieldCheck className="w-4 h-4 text-[#64748B] group-data-[highlighted]:text-[#007FFF] group-data-[state=open]:text-[#007FFF]" />
              </span>
              <TileBody label="Denied actions" description={activeDenial.name} />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={10} className={`${FLYOUT} w-[240px]`}>
              {DENIAL_OPTIONS.map((opt) => (
                <FlyoutRow
                  key={opt.id}
                  active={opt.id === denial}
                  icon={opt.icon}
                  label={opt.name}
                  description={opt.subtext}
                  onSelect={() => setDenialStyle(opt.id)}
                />
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* …then the model's own documentation. */}
          <DropdownMenuItem
            onSelect={() => navigate("/company-settings/user-access-control/access-matrix")}
            className={TILE_ROW}
          >
            <span className={TILE}>
              <Table2 className="w-4 h-4 text-[#64748B] group-data-[highlighted]:text-[#007FFF]" />
            </span>
            <TileBody
              label="Capability matrix"
              description="All levels against all capabilities"
            />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
