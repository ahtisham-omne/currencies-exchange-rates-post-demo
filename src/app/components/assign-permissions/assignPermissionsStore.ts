/* Tiny pub/sub so the "set up permissions" wizard can be opened from anywhere
 * (the import completion hand-off, the roles listing nudge / bulk action, the
 * role detail empty state) without prop-drilling. Mirrors the import-notice
 * store pattern in roles-row-store. The wizard itself is rendered once, high
 * in the tree, and reads its target from here. */
import { useSyncExternalStore } from "react";

export interface AssignPermissionsTarget {
  /** Role ids to set up, in order. Draft roles usually, but any custom role
   *  works, the wizard just seeds from whatever permissions each already has. */
  roleIds: number[];
  /** Where the flow was launched from, used only for a subtle copy tweak. */
  source: "import" | "listing" | "detail";
}

let target: AssignPermissionsTarget | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

/** Open the wizard for the given roles. A no-op when the id list is empty. */
export function openAssignPermissions(
  roleIds: number[],
  source: AssignPermissionsTarget["source"] = "listing",
): void {
  const ids = Array.from(new Set(roleIds)).filter((id) => Number.isFinite(id));
  if (ids.length === 0) return;
  target = { roleIds: ids, source };
  notify();
}

export function closeAssignPermissions(): void {
  if (target === null) return;
  target = null;
  notify();
}

export function useAssignPermissionsTarget(): AssignPermissionsTarget | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => target,
    () => target,
  );
}
