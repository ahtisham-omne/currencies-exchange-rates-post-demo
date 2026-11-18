import { useSyncExternalStore, type ReactNode } from "react";
import { CheckCircle2, Eye, KeyRound, PencilLine, Shield, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { roles } from "../data/roles-data";

/* ─────────────────────────────────────────────────────────────────────────
 * Access levels — one string of state → capability booleans → UI gating
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The prototype has no auth layer, so the header avatar doubles as an access
 * switcher: pick a level and every gated surface in the app re-renders against
 * that level's capabilities, with no reload.
 *
 * WHY THE INDIRECTION. Components never ask "is this an approver?" — they ask
 * "may this action happen?". The level taxonomy is volatile (split Approve into
 * L1/L2, add an auditor seat, rename things); the capability set is stable
 * because it is pinned to the app's own permission catalog. Rearranging levels
 * therefore touches exactly one switch statement in this file.
 *
 * WHERE THE CAPABILITY NAMES COME FROM. Every capability below maps 1:1 onto a
 * real permission id in the `users-roles` module of `data/permissions-data.ts`
 * (the `ur-*` ids). Nothing here invents vocabulary the app does not already
 * use, which is what keeps the model auditable against the real catalog.
 *
 * NAMING. These booleans are always read through the `access.` namespace
 * (`const access = useAccessMode()` → `access.canCreateEditUser`) and never
 * destructured. That keeps authorization textually distinct from this repo's
 * existing `can*` locals, which mean form validity (`canProceed`, `canSubmit`)
 * or entity editability (`roleIsEditable` in RoleOverviewTab means "this role
 * is not a system role", NOT "the viewer may edit it" — the two are &&-ed,
 * never conflated).
 *
 * STATE lives in a module-scope external store rather than React context, so
 * non-component call sites can read it too — the row-action menus are built
 * from table config modules (`data/user-requests-table-config.tsx`) that sit
 * outside any provider. It also means leaf components render correctly in
 * isolation (tests, print views) with the default All Access level.
 *
 * PRODUCTION CAVEAT. Anyone can flip the dropdown, so this provides ZERO
 * security. When real auth lands, keep `useAccessMode()`'s shape exactly as it
 * is and source the level from a server-validated role instead of this store;
 * then re-enforce every capability server-side. The capability-boolean
 * indirection is precisely what makes that a one-file change.
 * ───────────────────────────────────────────────────────────────────────── */

export type AccessLevel =
  | "all"
  | "view_only"
  | "create_edit"
  | "grant_access"
  | "approve";

/** How a capability-denied affordance degrades. Reuses the vocabulary already
 *  established by the View-in-Module simulator (`view-in-module/types.ts`). */
export type DenialStyle = "hidden" | "disabled";

export interface AccessCapabilities {
  /* ── Read surfaces ── */
  /** ur-access — reach the module at all. */
  canAccessModule: boolean;
  /** ur-view-billing — license cost columns, billing KPIs, cost insights. */
  canViewBilling: boolean;
  /** ur-view-audit — the activity / audit-trail tabs. */
  canViewAudit: boolean;
  /** See the permission-request queue. Acting on it is a separate capability.
   *  No catalog permission backs either half any more: Users and Roles v1.3
   *  removed View permission requests and Approve and reject permission
   *  requests when Permission Requests was deferred out of Pioneer. The
   *  prototype surface is still built, so the capability stays and gates it. */
  canViewRequests: boolean;

  /* ── Authoring ── */
  /** ur-create-user — create and edit user records. Excludes roles, license,
   *  archive and credentials, exactly as the permission's own note says. */
  canCreateEditUser: boolean;
  /** ur-create-role — create, edit and duplicate roles. */
  canCreateEditRole: boolean;
  /** Quick Invite, Send Invitation, Resend Invitation. Authoring a person. */
  canInvite: boolean;
  /** Notes and attachments on user / role detail. */
  canManageNotes: boolean;

  /* ── Access granting (the privileged half) ── */
  /** ur-assign-roles (Assign roles) — role assignment only; per-user direct
   *  grants are exclusively `canManagePermissions`. */
  canAssignRoles: boolean;
  /** ur-manage-permissions — direct per-user permission assignments. */
  canManagePermissions: boolean;
  /** ur-manage-roles — the scoped role-ownership configuration. */
  canManageRoles: boolean;
  /** Assign and remove role owners. */
  canManageRoleOwners: boolean;
  /** Approve or reject the self-service queue. Deferred alongside
   *  `canViewRequests`, see the note there. */
  canApproveRequests: boolean;

  /* ── Lifecycle ── */
  /** ur-deactivate-user + ur-archive-user — deactivate / reactivate and
   *  archive / unarchive. v1.3 split the old bundled permission in two; this
   *  capability still gates the whole row-actions group. */
  canArchiveUser: boolean;
  /** ur-deactivate-role + ur-archive-role — the role-side equivalent. The
   *  ERP-5550 catalogue (11 Aug) took single-role deactivate / reactivate and
   *  archive / unarchive out of Create and edit roles, so pausing or archiving
   *  a role is no longer implied by being able to rename one. Every level that
   *  authors roles also holds this today, which is why nothing in the UI
   *  changes yet; the attribution is what moved. */
  canManageRoleLifecycle: boolean;
  /** ur-reset-password (+ Reset MFA) — credential actions. */
  canResetCredentials: boolean;
  /** ur-manage-licenses — upgrade / downgrade / remove a license. */
  canManageLicenses: boolean;

  /* ── Bulk & data movement ── */
  /** Any bulk action bar appears at all. */
  canBulkEdit: boolean;
  /** ur-bulk-deactivate-users — the bulk Deactivate button only. Split from
   *  canBulkArchive by the ERP-5550 catalogue, which made Bulk Deactivate Users
   *  a permission in its own right alongside Bulk Archive Users. */
  canBulkDeactivateUsers: boolean;
  /** ur-bulk-archive — the bulk Archive button only; bulk deactivate is
   *  canBulkDeactivateUsers. */
  canBulkArchive: boolean;
  /** ur-bulk-roles-destructive — bulk deactivate / archive of ROLES. Its own
   *  catalogue permission, granted independently of the single-role pair behind
   *  canManageRoleLifecycle, so it cannot be implied by that capability. */
  canBulkRoleLifecycle: boolean;
  /** ur-bulk-license */
  canBulkLicense: boolean;
  /** ur-bulk-import-users — the Import action. Needs nothing else
   *  (ERP-5550 AC5); without it Import is shown disabled (AC3). */
  canImportUsers: boolean;
  /** ur-export-users (+ Export Roles). Needs nothing else (ERP-5550 AC5);
   *  without it Export is shown disabled (AC3). Every level holds it today. */
  canExportUsers: boolean;

  /* ── Configuration ── */
  /** Alert / notification toggles on user and role detail. */
  canEditAlerts: boolean;
}

/* ─── Scope: the second half of the question ───────────────────────────────
 *
 * A capability says WHAT KIND of action a level may take. It says nothing
 * about WHICH records it may take it on. `ur-manage-roles` is the only
 * capability in this module that is scoped, so it is the only one that needs
 * this. Everything else in the matrix applies to every record equally.
 * ───────────────────────────────────────────────────────────────────────── */

export type ManageRolesScope = "all" | "selected";

export interface ManageRolesScopeConfig {
  /** "all" manages every role; "selected" manages only `managedRoleIds`. */
  scope: ManageRolesScope;
  /** Role ids managed when `scope` is "selected". Ignored when it is "all". */
  managedRoleIds: number[];
}

export interface AccessPersona extends AccessCapabilities, ManageRolesScopeConfig {
  level: AccessLevel;
  /** Menu label, e.g. "View Only". */
  label: string;
  /** One-line description shown under the label. Levels whose Manage Roles is
   *  scoped get the scope appended here rather than to a separate adornment,
   *  so the switcher rows keep their existing height. */
  description: string;
  icon: LucideIcon;
}

/* ─── The levels, in menu order ───
 *
 * "All Access" first so the default reads as the unrestricted state, then the
 * restricted levels. `grant_access` exists because this module's whole subject
 * IS granting access — separating "who may author a person" from "who may give
 * that person power" is the central control in a UAC module, and collapsing it
 * into Create / Edit would lose the most important distinction the module has
 * to make. */
const LEVEL_META: { level: AccessLevel; label: string; description: string; icon: LucideIcon }[] = [
  {
    level: "all",
    label: "All Access",
    description: "Full access to all actions",
    icon: Shield,
  },
  {
    level: "view_only",
    label: "View Only",
    description: "Can only view users and roles",
    icon: Eye,
  },
  {
    level: "create_edit",
    label: "Create / Edit",
    description: "Create and edit, cannot grant access",
    icon: PencilLine,
  },
  {
    level: "grant_access",
    label: "Grant Access",
    description: "Assign roles and permissions",
    icon: KeyRound,
  },
  {
    level: "approve",
    label: "Approve",
    description: "Approve and reject requests",
    icon: CheckCircle2,
  },
];

/* ─── The deriver: level → capabilities ───
 *
 * NON-OBVIOUS MAPPINGS (business-rule-driven, not naive — the rules come from
 * the role descriptions in predefined-roles.ts, whose real roles these levels
 * generalise: Super Administrator, Basic User / Compliance Auditor, HR
 * Administrator, Access and Security Manager, Role Owner):
 *
 * │ Rule                                       │ Reason
 * ├────────────────────────────────────────────┼─────────────────────────────
 * │ grant_access has canAssignRoles but NOT    │ "Owns who gets access … Does
 * │ canCreateEditUser                          │  not create employee
 * │                                            │  records." The person who
 * │                                            │  grants power is not the
 * │                                            │  person who invents the
 * │                                            │  identity receiving it.
 * ├────────────────────────────────────────────┼─────────────────────────────
 * │ create_edit has canArchiveUser but NOT     │ HR "onboards and offboards
 * │ canAssignRoles / canManageLicenses         │  people … Cannot grant
 * │                                            │  access." Offboarding is
 * │                                            │  authoring; roles and
 * │                                            │  licenses are access.
 * ├────────────────────────────────────────────┼─────────────────────────────
 * │ approve has canAssignRoles: true           │ Approving a request IS an
 * │                                            │  assignment — an approver who
 * │                                            │  cannot assign cannot fulfil
 * │                                            │  what they approve.
 * ├────────────────────────────────────────────┼─────────────────────────────
 * │ approve has canManagePermissions: false    │ May approve against an
 * │                                            │  existing permission set but
 * │                                            │  never author the set itself.
 * ├────────────────────────────────────────────┼─────────────────────────────
 * │ canViewRequests: true for every level,     │ Seeing the queue and acting
 * │ canApproveRequests for only two            │  on it stay separate even
 * │                                            │  though v1.3 retired both
 * │                                            │  backing permissions.
 * ├────────────────────────────────────────────┼─────────────────────────────
 * │ canExportUsers: true even for view_only    │ Export reads; auditors need
 * │                                            │  evidence. Import is the
 * │                                            │  write half, gated separately.
 * ├────────────────────────────────────────────┼─────────────────────────────
 * │ canAccessModule: true for every level      │ Read access to the module is
 * │                                            │  never gated here.
 * ├────────────────────────────────────────────┼─────────────────────────────
 * │ canBulkDeactivateUsers mirrors             │ The ERP-5550 catalogue split
 * │ canBulkArchive, and canBulkRoleLifecycle   │  Bulk Deactivate Users and
 * │ mirrors canManageRoleLifecycle             │  Bulk Deactivate or Archive
 * │                                            │  Roles out as permissions of
 * │                                            │  their own. Both are new
 * │                                            │  ATTRIBUTION, not a new
 * │                                            │  restriction: every level
 * │                                            │  holding the old capability
 * │                                            │  still holds these, so no UI
 * │                                            │  changes. They exist so the
 * │                                            │  two permissions are
 * │                                            │  representable at all, and so
 * │                                            │  a future spec can narrow the
 * │                                            │  bulk half without touching
 * │                                            │  the single-record half. The
 * │                                            │  catalogue is explicit that a
 * │                                            │  bulk permission is granted
 * │                                            │  independently of its
 * │                                            │  single-record counterpart,
 * │                                            │  so one may never imply the
 * │                                            │  other.
 */
function derivePermissions(level: AccessLevel): AccessCapabilities {
  switch (level) {
    case "view_only":
      return {
        canAccessModule: true,
        canViewBilling: true,
        canViewAudit: true,
        canViewRequests: true,

        canCreateEditUser: false,
        canCreateEditRole: false,
        canInvite: false,
        canManageNotes: false,

        canAssignRoles: false,
        canManagePermissions: false,
        canManageRoles: false,
        canManageRoleOwners: false,
        canApproveRequests: false,

        canArchiveUser: false,
        canManageRoleLifecycle: false,
        canResetCredentials: false,
        canManageLicenses: false,

        canBulkEdit: false,
        canBulkDeactivateUsers: false,
        canBulkArchive: false,
        canBulkRoleLifecycle: false,
        canBulkLicense: false,
        canImportUsers: false,
        canExportUsers: true,

        canEditAlerts: false,
      };

    case "create_edit":
      return {
        canAccessModule: true,
        canViewBilling: false,
        canViewAudit: false,
        canViewRequests: true,

        canCreateEditUser: true,
        canCreateEditRole: true,
        canInvite: true,
        canManageNotes: true,

        canAssignRoles: false,
        canManagePermissions: false,
        canManageRoles: false,
        canManageRoleOwners: false,
        canApproveRequests: false,

        canArchiveUser: true,
        canManageRoleLifecycle: true,
        canResetCredentials: true,
        canManageLicenses: false,

        canBulkEdit: true,
        canBulkDeactivateUsers: true,
        canBulkArchive: true,
        canBulkRoleLifecycle: true,
        canBulkLicense: false,
        canImportUsers: true,
        canExportUsers: true,

        canEditAlerts: true,
      };

    case "grant_access":
      return {
        canAccessModule: true,
        canViewBilling: true,
        canViewAudit: true,
        canViewRequests: true,

        canCreateEditUser: false,
        canCreateEditRole: true,
        canInvite: false,
        canManageNotes: true,

        canAssignRoles: true,
        canManagePermissions: true,
        canManageRoles: true,
        canManageRoleOwners: true,
        canApproveRequests: true,

        canArchiveUser: false,
        canManageRoleLifecycle: true,
        canResetCredentials: true,
        canManageLicenses: true,

        canBulkEdit: true,
        canBulkDeactivateUsers: false,
        canBulkArchive: false,
        canBulkRoleLifecycle: true,
        canBulkLicense: true,
        canImportUsers: false,
        canExportUsers: true,

        canEditAlerts: true,
      };

    case "approve":
      return {
        canAccessModule: true,
        canViewBilling: false,
        canViewAudit: true,
        canViewRequests: true,

        canCreateEditUser: false,
        canCreateEditRole: false,
        canInvite: false,
        canManageNotes: true,

        canAssignRoles: true,
        canManagePermissions: false,
        canManageRoles: true,
        canManageRoleOwners: false,
        canApproveRequests: true,

        canArchiveUser: false,
        canManageRoleLifecycle: false,
        canResetCredentials: false,
        canManageLicenses: false,

        canBulkEdit: true,
        canBulkDeactivateUsers: false,
        canBulkArchive: false,
        canBulkRoleLifecycle: false,
        canBulkLicense: false,
        canImportUsers: false,
        canExportUsers: true,

        canEditAlerts: false,
      };

    case "all":
    default:
      return {
        canAccessModule: true,
        canViewBilling: true,
        canViewAudit: true,
        canViewRequests: true,

        canCreateEditUser: true,
        canCreateEditRole: true,
        canInvite: true,
        canManageNotes: true,

        canAssignRoles: true,
        canManagePermissions: true,
        canManageRoles: true,
        canManageRoleOwners: true,
        canApproveRequests: true,

        canArchiveUser: true,
        canManageRoleLifecycle: true,
        canResetCredentials: true,
        canManageLicenses: true,

        canBulkEdit: true,
        canBulkDeactivateUsers: true,
        canBulkArchive: true,
        canBulkRoleLifecycle: true,
        canBulkLicense: true,
        canImportUsers: true,
        canExportUsers: true,

        canEditAlerts: true,
      };
  }
}

/* ─── The deriver: level → Manage Roles scope ───
 *
 * Only levels that actually hold `ur-manage-roles` carry a meaningful scope.
 * Per the capability deriver above that is All Access, Grant Access and
 * Approve. View Only and Create / Edit hold no scoped capability at all, so
 * they are given "all" — not because they manage everything, but because scope
 * must never be the thing that denies them; their capability booleans already
 * do, and a "selected" fixture there would invent a second reason for the same
 * denial and make the copy wrong.
 *
 * The Grant Access / Approve fixtures overlap on Senior Buyer deliberately, so
 * switching between them visibly moves the scoped set instead of reading as
 * two unrelated lists.
 *
 *   26 Compliance Auditor · 27 Sales Operations Analyst
 *   28 Senior Buyer       · 29 Warehouse Operator          (see roles-data.ts)
 *
 * All four are the sample company's custom roles. A company from onboarding
 * has none (onboarding-handoff.ts drops them before the app loads), so the
 * fixtures keep only roles that exist, which leaves these two scoped to none
 * of its roles until it makes some. */
const existingRoleIds = (ids: number[]) => ids.filter((id) => roles.some((r) => r.id === id));

function deriveManageRolesScope(level: AccessLevel): ManageRolesScopeConfig {
  switch (level) {
    case "grant_access":
      return { scope: "selected", managedRoleIds: existingRoleIds([26, 27, 28]) };
    case "approve":
      return { scope: "selected", managedRoleIds: existingRoleIds([28, 29]) };
    case "view_only":
    case "create_edit":
    case "all":
    default:
      return { scope: "all", managedRoleIds: [] };
  }
}

/** Every level, resolved. Drives the switcher list and the capability matrix.
 *  Adding a level = one entry in LEVEL_META + one case in each deriver.
 *
 *  The scope suffix is composed here rather than written into LEVEL_META so the
 *  count can never drift from the fixture it describes. */
export const ACCESS_LEVELS: AccessPersona[] = LEVEL_META.map((m) => {
  const scope = deriveManageRolesScope(m.level);
  const scopedSuffix =
    scope.scope === "selected"
      ? `, scoped to ${scope.managedRoleIds.length} role${scope.managedRoleIds.length === 1 ? "" : "s"}`
      : "";
  return {
    ...m,
    description: `${m.description}${scopedSuffix}`,
    ...derivePermissions(m.level),
    ...scope,
  };
});

/** Is this role inside the persona's Manage Roles scope? The scope half of the
 *  gate; it grants nothing on its own and is always &&-ed with a capability. */
export function isRoleInScope(roleId: number, persona: AccessPersona): boolean {
  if (persona.scope === "all") return true;
  return persona.managedRoleIds.includes(roleId);
}

/** Capability labels for the matrix page. Keys are checked against
 *  `AccessCapabilities` by the compiler, so a renamed capability breaks here. */
export const CAPABILITY_GROUPS: {
  group: string;
  items: {
    key: keyof AccessCapabilities;
    label: string;
    permissionId: string;
    /** True for a capability whose grant is limited to a set of records, so a
     *  tick in the matrix does not mean "on every record". `ur-manage-roles` is
     *  the only one in this module. */
    scoped?: boolean;
  }[];
}[] = [
  {
    group: "Read",
    items: [
      { key: "canAccessModule", label: "Access Users and Roles module", permissionId: "ur-access" },
      { key: "canViewBilling", label: "View billing overview and cost impact", permissionId: "ur-view-billing" },
      { key: "canViewAudit", label: "View access audit logs", permissionId: "ur-view-audit" },
      { key: "canViewRequests", label: "View permission requests", permissionId: "no catalog permission, deferred" },
    ],
  },
  {
    group: "Authoring",
    items: [
      { key: "canCreateEditUser", label: "Create and edit users", permissionId: "ur-create-user" },
      { key: "canCreateEditRole", label: "Create and edit roles", permissionId: "ur-create-role" },
      { key: "canInvite", label: "Invite and re-invite people", permissionId: "ur-create-user" },
      { key: "canManageNotes", label: "Add notes and attachments", permissionId: "ur-create-user" },
    ],
  },
  {
    group: "Access granting",
    items: [
      { key: "canAssignRoles", label: "Assign roles", permissionId: "ur-assign-roles" },
      { key: "canManagePermissions", label: "Manage granular permissions", permissionId: "ur-manage-permissions" },
      { key: "canManageRoles", label: "Manage roles (scoped)", permissionId: "ur-manage-roles", scoped: true },
      { key: "canManageRoleOwners", label: "Assign and remove role owners", permissionId: "ur-manage-roles" },
      { key: "canApproveRequests", label: "Approve and reject requests", permissionId: "no catalog permission, deferred" },
    ],
  },
  {
    group: "Lifecycle",
    items: [
      { key: "canArchiveUser", label: "Deactivate and archive users", permissionId: "ur-deactivate-user, ur-archive-user" },
      { key: "canManageRoleLifecycle", label: "Deactivate and archive roles", permissionId: "ur-deactivate-role, ur-archive-role" },
      { key: "canResetCredentials", label: "Reset password and MFA", permissionId: "ur-reset-password" },
      { key: "canManageLicenses", label: "Upgrade and downgrade licenses", permissionId: "ur-manage-licenses" },
    ],
  },
  {
    group: "Bulk and data",
    items: [
      { key: "canBulkEdit", label: "Use bulk actions", permissionId: "ur-bulk-archive" },
      { key: "canBulkDeactivateUsers", label: "Bulk deactivate users", permissionId: "ur-bulk-deactivate-users" },
      { key: "canBulkArchive", label: "Bulk archive users", permissionId: "ur-bulk-archive" },
      { key: "canBulkRoleLifecycle", label: "Bulk deactivate and archive roles", permissionId: "ur-bulk-roles-destructive" },
      { key: "canBulkLicense", label: "Bulk license changes", permissionId: "ur-bulk-license" },
      { key: "canImportUsers", label: "Bulk Import Users", permissionId: "ur-bulk-import-users" },
      { key: "canExportUsers", label: "Bulk Export Users and Roles", permissionId: "ur-export-users" },
    ],
  },
  {
    group: "Configuration",
    items: [
      { key: "canEditAlerts", label: "Change alert preferences", permissionId: "ur-access" },
    ],
  },
];

/* ─── Store (module scope, external-store pattern) ─── */

let activeLevel: AccessLevel = "all";
let denialStyle: DenialStyle = "hidden";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAccessLevel(): AccessLevel {
  return activeLevel;
}

export function setAccessLevel(level: AccessLevel) {
  if (level === activeLevel || !ACCESS_LEVELS.some((l) => l.level === level)) return;
  activeLevel = level;
  emit();
}

export function getDenialStyle(): DenialStyle {
  return denialStyle;
}

export function setDenialStyle(style: DenialStyle) {
  if (style === denialStyle) return;
  denialStyle = style;
  emit();
}

/** Non-reactive read, for module-level code that cannot call hooks. */
export function getAccessPersona(): AccessPersona {
  return ACCESS_LEVELS.find((l) => l.level === activeLevel) ?? ACCESS_LEVELS[0];
}

/** The active level and its capabilities, reactively. Read it as a namespace
 *  (`access.canAssignRoles`) rather than destructuring, so authorization stays
 *  visually distinct from this repo's validation-flavoured `can*` locals. */
export function useAccessMode(): AccessPersona {
  const level = useSyncExternalStore(subscribe, getAccessLevel, getAccessLevel);
  return ACCESS_LEVELS.find((l) => l.level === level) ?? ACCESS_LEVELS[0];
}

/** How capability-denied affordances degrade, reactively. */
export function useDenialStyle(): DenialStyle {
  return useSyncExternalStore(subscribe, getDenialStyle, getDenialStyle);
}

/* ─── Gating ───────────────────────────────────────────────────────────────
 *
 * THE ONE RULE: visibility is never the capability alone, it is
 * `capability && statusAllows`. The two halves are NOT interchangeable when a
 * denial has to be explained:
 *
 *   • statusAllows === false  →  ALWAYS hide. "Unarchive User" on an active
 *     user is meaningless, and showing it disabled would imply a permission
 *     problem where there is a state problem.
 *   • capability === false    →  hide OR show disabled, per the user's choice
 *     in the header menu. This is the only half the toggle governs.
 *
 * `useGate()` keeps that asymmetry honest by taking the halves separately, so
 * a call site physically cannot collapse them into one boolean.
 *
 *   const gate = useGate();
 *   const g = gate(isActive, access.canArchiveUser);
 *   {g.render && <MenuItem disabled={g.disabled} tooltip={g.reason} … />}
 * ───────────────────────────────────────────────────────────────────────── */

export interface Gate {
  /** Render the affordance at all. False when status forbids it, or when the
   *  capability is missing and the style is "hidden". */
  render: boolean;
  /** Render it inert and dimmed, with `reason` on hover. */
  disabled: boolean;
  /** Why it is disabled. Empty when the affordance is fully allowed. */
  reason: string;
}

const ALLOWED: Gate = { render: true, disabled: false, reason: "" };

export function useGate(): (statusAllows: boolean, capability: boolean, reason?: string) => Gate {
  const persona = useAccessMode();
  const style = useDenialStyle();
  return (statusAllows: boolean, capability: boolean, reason?: string) => {
    /* Status always wins, in both directions: if the record's state forbids the
     * action there is nothing to explain, so it never renders. */
    if (!statusAllows) return { render: false, disabled: false, reason: "" };
    if (capability) return ALLOWED;
    if (style === "hidden") return { render: false, disabled: false, reason: "" };
    return {
      render: true,
      disabled: true,
      reason: reason ?? `Not available with ${persona.label}`,
    };
  };
}

/** `useGate()` for an action that is always SHOWN when denied, whatever the
 *  Denied actions setting says. ERP-5550 AC3 (Eli, 8 Nov 2026): inside a
 *  module the user can open, an action they cannot use is shown, with a
 *  message that they need more permission. Used by Import and Export; the
 *  rest of the module still follows the hidden/disabled toggle until that
 *  rule is applied module-wide. Status still wins, as in `useGate()`. */
export function useShownGate(): (statusAllows: boolean, capability: boolean, reason?: string) => Gate {
  const persona = useAccessMode();
  return (statusAllows: boolean, capability: boolean, reason?: string) => {
    if (!statusAllows) return { render: false, disabled: false, reason: "" };
    if (capability) return ALLOWED;
    return {
      render: true,
      disabled: true,
      reason: reason ?? `Not available with ${persona.label}`,
    };
  };
}

/* ─── Scope gating ─────────────────────────────────────────────────────────
 *
 * Scope rides in the CAPABILITY half, not the status half. That placement is
 * the whole point: an out-of-scope action is a permission boundary, so it must
 * follow the user's Denied actions setting (hidden or shown-disabled) exactly
 * as a missing capability does. Putting it in the status half would hardcode
 * "hidden" and make the boundary undemonstrable in review.
 *
 * The reason string is only swapped when the level DOES hold the capability
 * and scope is what blocked it. When the capability is missing outright the
 * default "Not available with <level>" is the truthful explanation, and saying
 * "not in your scope" there would name the wrong cause.
 *
 *   const scoped = useScopedGate();
 *   const g = scoped(!isArchived, access.canAssignRoles, inScope);
 *   {g.render && <MenuItem disabled={g.disabled} title={g.reason} … />}
 * ───────────────────────────────────────────────────────────────────────── */

/** Hover copy for a single record the viewer's Manage Roles scope excludes. */
export const SCOPE_DENIED_REASON = "This role isn't in your Manage Roles scope";

/** Hover copy for a bulk selection that reaches outside the scope. */
export const SCOPE_DENIED_BULK_REASON =
  "Some selected roles aren't in your Manage Roles scope";

/** Whether one role is in the active level's Manage Roles scope, reactively. */
export function useRoleInScope(roleId: number): boolean {
  const persona = useAccessMode();
  return isRoleInScope(roleId, persona);
}

/** `useGate()` for a scoped capability. Takes the three halves separately so a
 *  call site cannot collapse them, and supplies the scope-specific reason. */
export function useScopedGate(): (
  statusAllows: boolean,
  capability: boolean,
  inScope: boolean,
  reason?: string,
) => Gate {
  const gate = useGate();
  return (statusAllows, capability, inScope, reason) =>
    gate(
      statusAllows,
      capability && inScope,
      capability && !inScope ? (reason ?? SCOPE_DENIED_REASON) : undefined,
    );
}

/** Wraps a single capability-gated affordance (a button, a CTA, an icon
 *  control). Renders nothing when hidden; when disabled, renders the children
 *  dimmed and click-proof with the reason on hover.
 *
 *  `aria-disabled` plus pointer-events suppression rather than the native
 *  `disabled` attribute, matching this repo's existing convention — a natively
 *  disabled element fires no hover events, so the tooltip explaining WHY could
 *  never appear. The capture-phase handler is the backstop for anything that
 *  still manages to dispatch a click.
 *
 *  For dropdown menu items use the `useGate()` values directly with Radix's own
 *  `disabled` prop instead, so keyboard navigation skips them correctly. */
export function AccessGate({
  statusAllows = true,
  capability,
  reason,
  side = "bottom",
  children,
}: {
  /** Status half — when false the affordance never renders, regardless of style. */
  statusAllows?: boolean;
  /** Capability half — the only half the hidden/disabled toggle governs. */
  capability: boolean;
  reason?: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}) {
  const gate = useGate()(statusAllows, capability, reason);
  if (!gate.render) return null;
  if (!gate.disabled) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-disabled="true"
          className="inline-flex opacity-45 cursor-not-allowed [&_*]:pointer-events-none"
          onClickCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[260px]">
        {gate.reason}
      </TooltipContent>
    </Tooltip>
  );
}
