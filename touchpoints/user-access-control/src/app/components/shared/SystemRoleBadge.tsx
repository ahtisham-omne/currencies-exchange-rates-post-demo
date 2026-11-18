import { LockKeyhole, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { ACCOUNT_OWNER_COPY } from "../../data/account-owner";

/**
 * Small filled lock icon displayed inline next to system/predefined role names.
 * Conveys "this is a system role, locked, but copyable."
 */
export function SystemRoleLock({ size = 12 }: { size?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center shrink-0 cursor-default">
          <LockKeyhole
            className="shrink-0"
            style={{
              width: size,
              height: size,
              color: "#94A3B8",
              fill: "#94A3B8",
              fillOpacity: 0.18,
            }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        System role. It can be copied but not edited, deactivated, or archived.
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Small amber alert icon shown inline before a role name when the role has no
 * permissions yet (Draft). Mirrors the lock/shield badge treatment, and its
 * white-theme tooltip explains why the role can't be used yet.
 */
export function NoPermissionsRoleBadge({ size = 13 }: { size?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center shrink-0 cursor-default" aria-label="No permissions yet">
          <AlertTriangle
            className="shrink-0"
            style={{
              width: size,
              height: size,
              color: "#D97706",
              fill: "#F59E0B",
              fillOpacity: 0.16,
            }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-[280px]">
        This role has no permissions yet, so it can't be used. Set up its permissions to activate it.
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Protected-role indicator shown next to the lock on the Account Owner row.
 * Protected: it always keeps one holder, and no other user can lock an owner out.
 */
export function ProtectedRoleBadge({ size = 13 }: { size?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center shrink-0 cursor-default">
          <ShieldCheck
            className="shrink-0"
            style={{
              width: size,
              height: size,
              color: "#7C3AED",
              fill: "#8B5CF6",
              fillOpacity: 0.16,
            }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        Protected role. It always keeps at least one holder, and no other user can deactivate, archive, or lock out an Account Owner.
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Protected-user indicator shown next to the name of every Account Owner, in
 * the listing and on the profile, so an admin sees the protection before
 * trying an action it blocks (ERP-5171 AC16, ERP-5173 AC12).
 */
export function ProtectedUserBadge({ size = 13 }: { size?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center shrink-0 cursor-default" aria-label="Protected user">
          <ShieldCheck
            className="shrink-0"
            style={{
              width: size,
              height: size,
              color: "#7C3AED",
              fill: "#8B5CF6",
              fillOpacity: 0.16,
            }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-[300px]">
        {ACCOUNT_OWNER_COPY.badge}
      </TooltipContent>
    </Tooltip>
  );
}
