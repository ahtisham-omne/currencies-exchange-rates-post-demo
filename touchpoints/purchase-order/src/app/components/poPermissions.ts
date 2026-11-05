/* ═══════════════════════════════════════════════════════════════
   PO PERMISSIONS STORE (Pioneer v1.0 — dev widget backed)

   Publish/subscribe pattern — same shape as plannerDevMode.ts.

   Seven permissions from "Purchase Orders — Pioneer Permissions v1.0"
   (BA: Rida Iftikhar · reviewed by Eli). Defaults come straight from the
   spec's "Default On/Off" column. The store enforces the *Requires*
   dependency graph: turning off `po.create_edit` cascades every
   dependent permission off, since the spec lists Create-and-edit as an
   AND-dependency beyond the module-access gate.

   The store is dev-only (toggled through POPermissionsDevWidget). Real
   users always see the spec defaults; no persistence is loaded in tests.

   Spec / master doc: Roles & Permissions, Cross-Domain Spec Pioneer.
   Do not edit these keys in isolation from the master.
   ═══════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";

/* ── Permission catalog ─────────────────────────────────────────── */

export type POPermissionId =
  | "po.access"
  | "po.create_edit"
  | "po.non_qualified_vendors"
  | "po.cancel_archive"
  | "po.bulk_import"
  | "po.modify_pricing_rules"
  | "po.one_time_discounts";

export type POPermissionGroup =
  | "Module access"
  | "PO management"
  | "Elevated procurement"
  | "Destructive action"
  | "Bulk operation"
  | "Pricing";

export interface POPermissionSpec {
  id: POPermissionId;
  label: string;
  group: POPermissionGroup;
  /** Short (< 240 chars) plain-English "what it grants" for the widget. */
  grants: string;
  /** "When to restrict" copy — surfaces under the toggle. */
  restrict: string;
  /** AND-dependency beyond the module-access gate. Empty = only requires
      po.access. The store cascades off dependents when a required perm
      is turned off. */
  requires: POPermissionId[];
  /** Free-form scope/config note ("Vendor scope · category scope · max PO
      value threshold" etc.). Rendered as a small caption in the widget. */
  scope: string;
  /** Spec default. */
  defaultOn: boolean;
}

/* Order matches the spec table. Widget renders in this order. */
export const PO_PERMISSIONS: readonly POPermissionSpec[] = [
  {
    id: "po.access",
    label: "Access Purchase Orders module",
    group: "Module access",
    grants:
      "Shows all PO records including line items, quantities, delivery dates, vendor details, and history. Includes the ability to print and download individual POs.",
    restrict:
      "Default On. Off for roles with no procurement involvement, including sales, HR, and finance-only roles.",
    requires: [],
    scope: "All items and categories.",
    defaultOn: true,
  },
  {
    id: "po.create_edit",
    label: "Create and edit purchase orders",
    group: "PO management",
    grants:
      "Creates POs and edits them at any active stage. Covers reopening or revising POs past Draft (which creates a new version), moving POs between states of the PO lifecycle, and reactivating cancelled ones. Approval is not included.",
    restrict:
      "Default Off. Procurement staff only. Most operational roles should not be able to initiate spending.",
    requires: [],
    scope: "Vendor scope · category scope · max PO value threshold.",
    defaultOn: false,
  },
  {
    id: "po.non_qualified_vendors",
    label: "Purchase from non-qualified vendors",
    group: "Elevated procurement",
    grants:
      "Orders an item from a vendor not on its approved vendor list, bypassing the qualified-vendor control. Without it, the system blocks any PO line where the vendor is not pre-qualified for the item.",
    restrict:
      "Default On. Most companies do not regulate who buyers can buy from, and restricting this just ties their hands. Off only for large enterprises with formal vendor vetting in place.",
    requires: ["po.create_edit"],
    scope: "None.",
    defaultOn: true,
  },
  {
    id: "po.cancel_archive",
    label: "Cancel or archive purchase orders",
    group: "Destructive action",
    grants:
      "Cancels an active PO (moves it to Cancelled, still visible) or archives a PO (removes it from active views). Both end the PO's active lifecycle.",
    restrict:
      "Default Off. Procurement managers or administrators only. Cancelling or archiving an active PO before its goods arrive pulls it off the active queue — missed receipts often don't show up until a stockout.",
    requires: [],
    scope: "None.",
    defaultOn: false,
  },
  {
    id: "po.bulk_import",
    label: "Bulk Import POs",
    group: "Bulk operation",
    grants:
      "Imports multiple POs in a single operation (CSV/file upload). Each imported PO is subject to the same validation as a manually created one. The landing state is set by the import file, not fixed to Draft.",
    restrict:
      "Default Off. Senior procurement managers, ops lead, or data-migration roles only. A bad import file can create thousands of incorrect POs at once with no easy rollback.",
    requires: ["po.create_edit"],
    scope: "None.",
    defaultOn: false,
  },
  {
    id: "po.modify_pricing_rules",
    label: "Modify pricing rules",
    group: "Pricing",
    grants:
      "Creates, edits, or deletes pricing rules within the Pricing Rules submodule (accessible from SO, Quotes, PO, and Partners). Bundles create / edit / activate-deactivate authority.",
    restrict:
      "Off by default. Standard buyers should work within pre-configured vendor pricing rules. Senior buyers, purchasing managers, and commercial-authority holders only.",
    requires: ["po.create_edit"],
    scope: "None.",
    defaultOn: false,
  },
  {
    id: "po.one_time_discounts",
    label: "Add one-time discounts and premiums",
    group: "Pricing",
    grants:
      "Adds ad-hoc discounts or premiums at the line-item or PO level. Applies only to the PO it's added on — does not affect vendor pricing rules or the item-vendor pricing configuration.",
    restrict:
      "Off by default. Enabling this lets the buyer override vendor pricing on a PO outside the configured pricing rules. Commercial authority gate.",
    requires: ["po.create_edit"],
    scope: "Threshold control deferred to Layer 3 (post-Bubba).",
    defaultOn: false,
  },
] as const;

/* Lookup for O(1) spec access. */
const SPEC_BY_ID: Record<POPermissionId, POPermissionSpec> = PO_PERMISSIONS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<POPermissionId, POPermissionSpec>,
);

/* ── Internal state ─────────────────────────────────────────────── */

const STORE_KEY = "po:permissions:v1";

export type POPermissionState = Record<POPermissionId, boolean>;

function defaultState(): POPermissionState {
  /* Dev widget baseline: all seven permissions ON so every gated
     surface renders on first load. Reset returns here. The spec's
     per-permission `defaultOn` still lives on each entry as the
     intended *production* default (for docs / real-user rollout),
     but for prototyping we want everything visible up-front. */
  return PO_PERMISSIONS.reduce((acc, s) => {
    acc[s.id] = true;
    return acc;
  }, {} as POPermissionState);
}

/* Enforce the dependency cascade every time we materialise a state.
   If a required perm is off, every dependent perm is forced off too.
   Runs iteratively so transitive dependencies (A → B → C) resolve in one
   pass — safe because the dep graph is a DAG. */
function applyCascade(state: POPermissionState): POPermissionState {
  const next: POPermissionState = { ...state };
  let changed = true;
  while (changed) {
    changed = false;
    for (const spec of PO_PERMISSIONS) {
      if (!next[spec.id]) continue;
      for (const req of spec.requires) {
        if (!next[req]) {
          next[spec.id] = false;
          changed = true;
          break;
        }
      }
    }
  }
  return next;
}

function loadState(): POPermissionState {
  const fallback = defaultState();
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORE_KEY)
        : null;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<POPermissionState>;
    const merged = { ...fallback, ...parsed };
    return applyCascade(merged);
  } catch {
    return fallback;
  }
}

let _state: POPermissionState = loadState();

type Listener = () => void;
const _listeners = new Set<Listener>();

function persist() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORE_KEY, JSON.stringify(_state));
    }
  } catch {
    /* ignore quota / disabled storage */
  }
}

function notify() {
  _listeners.forEach((fn) => fn());
}

/* ── Public API ─────────────────────────────────────────────────── */

export function getPOPermissions(): POPermissionState {
  return _state;
}

export function getPOPermissionSpec(id: POPermissionId): POPermissionSpec {
  return SPEC_BY_ID[id];
}

/** Toggle a permission. Cascades dependents off when required perms are
    turned off. Replaces (never mutates) the state so useSyncExternalStore
    snapshots stay reference-stable between notifications. */
export function setPOPermission(id: POPermissionId, value: boolean) {
  const next = { ..._state, [id]: value };
  const cascaded = applyCascade(next);
  if (
    cascaded[id] === _state[id] &&
    PO_PERMISSIONS.every((s) => cascaded[s.id] === _state[s.id])
  ) {
    return;
  }
  _state = cascaded;
  persist();
  notify();
}

export function resetPOPermissions() {
  const fresh = defaultState();
  const cascaded = applyCascade(fresh);
  _state = cascaded;
  persist();
  notify();
}

export function subscribePOPermissions(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Reactive: subscribe to the whole permission map. */
export function usePOPermissions(): POPermissionState {
  return useSyncExternalStore(
    subscribePOPermissions,
    getPOPermissions,
    getPOPermissions,
  );
}

/** Reactive single-permission gate. The most common consumer at UI
    call-sites. Callers should treat `false` as "surface disabled + show
    tooltip explaining which permission is missing". */
export function useCan(id: POPermissionId): boolean {
  const state = usePOPermissions();
  return state[id];
}

/* ── Personas ────────────────────────────────────────────────────
   Curated permission bundles mapped from the spec's "when to restrict"
   language. Match Cycle Count's persona-mode.tsx dropdown pattern: one
   picker collapses the 7-toggle matrix into 5 realistic roles. The
   dev widget still exposes a Custom (advanced) view underneath for
   edge cases; picking a persona replaces the current state atomically. */

export type POPersonaId =
  | "no_access"
  | "view_only"
  | "buyer"
  | "senior_buyer"
  | "manager"
  | "custom";

export interface POPersonaSpec {
  id: Exclude<POPersonaId, "custom">;
  label: string;
  description: string;
  permissions: POPermissionState;
}

/** Build a full permission map from a set of overrides. Keeps the
    persona catalog terse — omitted keys default to false. */
function buildPersonaState(overrides: Partial<POPermissionState>): POPermissionState {
  const base = PO_PERMISSIONS.reduce((acc, s) => {
    acc[s.id] = false;
    return acc;
  }, {} as POPermissionState);
  return applyCascade({ ...base, ...overrides });
}

export const PO_PERSONAS: readonly POPersonaSpec[] = [
  {
    id: "no_access",
    label: "No Access",
    description: "Sales, HR, finance-only. No procurement involvement.",
    permissions: buildPersonaState({}),
  },
  {
    id: "view_only",
    label: "View Only",
    description: "Read-only participant. Sees PO records but can't create or change them.",
    permissions: buildPersonaState({ "po.access": true }),
  },
  {
    id: "buyer",
    label: "Buyer",
    description:
      "Standard procurement staff. Creates and edits POs; can order from non-qualified vendors.",
    permissions: buildPersonaState({
      "po.access": true,
      "po.create_edit": true,
      "po.non_qualified_vendors": true,
    }),
  },
  {
    id: "senior_buyer",
    label: "Senior Buyer",
    description:
      "Commercial authority holder. Buyer plus pricing rules and one-time discounts.",
    permissions: buildPersonaState({
      "po.access": true,
      "po.create_edit": true,
      "po.non_qualified_vendors": true,
      "po.modify_pricing_rules": true,
      "po.one_time_discounts": true,
    }),
  },
  {
    id: "manager",
    label: "Procurement Manager",
    description:
      "Admin. Every permission on — cancel/archive and bulk import included.",
    permissions: buildPersonaState({
      "po.access": true,
      "po.create_edit": true,
      "po.non_qualified_vendors": true,
      "po.cancel_archive": true,
      "po.bulk_import": true,
      "po.modify_pricing_rules": true,
      "po.one_time_discounts": true,
    }),
  },
] as const;

/** Replace the whole permission map with the persona's map. Runs the
    dependency cascade defensively so an ill-formed persona (e.g. a
    dependent on without its parent) can't get through. */
export function applyPOPersona(id: Exclude<POPersonaId, "custom">) {
  const persona = PO_PERSONAS.find((p) => p.id === id);
  if (!persona) return;
  const next = applyCascade({ ...persona.permissions });
  if (PO_PERMISSIONS.every((s) => next[s.id] === _state[s.id])) return;
  _state = next;
  persist();
  notify();
}

/** Which persona (if any) the current state exactly matches. Returns
    "custom" when the user has hand-tuned toggles that don't line up
    with any canned persona. */
export function getActivePOPersona(): POPersonaId {
  for (const persona of PO_PERSONAS) {
    if (
      PO_PERMISSIONS.every(
        (s) => persona.permissions[s.id] === _state[s.id],
      )
    ) {
      return persona.id;
    }
  }
  return "custom";
}

/** Reactive: current persona derived from state. */
export function useActivePOPersona(): POPersonaId {
  const state = usePOPermissions();
  for (const persona of PO_PERSONAS) {
    if (
      PO_PERMISSIONS.every((s) => persona.permissions[s.id] === state[s.id])
    ) {
      return persona.id;
    }
  }
  return "custom";
}

/** Human-readable reason a permission is currently off. Used for the
    tooltip on disabled surfaces. */
export function permissionReason(id: POPermissionId): string {
  const spec = SPEC_BY_ID[id];
  const state = _state;
  if (state[id]) return "";
  const missingReq = spec.requires.find((r) => !state[r]);
  if (missingReq) {
    return `Requires "${SPEC_BY_ID[missingReq].label}". Enable it first in the Permissions widget.`;
  }
  return `Requires the "${spec.label}" permission.`;
}
