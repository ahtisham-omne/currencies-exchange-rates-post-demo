/* ─── Signed-in viewer (prototype persona) ───
 *
 * Who the prototype pretends is signed in, for rules that depend on the
 * viewer's identity rather than on an access level. The Account Owner rules
 * (UAC Spec, Roles, Section 11) are the reason this exists: several actions on
 * an Account Owner are open only to that owner, signed in as themselves.
 *
 * Switched from the header user menu ("Signed in as"). The default is
 * CURRENT_USER: the prototype's admin persona, who holds no Account Owner
 * role, or, after an onboarding hand-off, the person who ran setup.
 *
 * Deliberately separate from `isMe` in current-user.ts: Me Mode fixtures are
 * seeded for CURRENT_USER and stay that way whoever is signed in here. */
import { useSyncExternalStore } from "react";
import { CURRENT_USER } from "./current-user";
import { users } from "./users-data";

export interface ViewerProfile {
  id: number;
  name: string;
  email: string;
}

/* Null until someone is picked from the menu, and CURRENT_USER is read when
 * asked rather than copied at import: the onboarding hand-off can sign in as
 * someone else before the first render, after this module has loaded. */
let viewerId: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getViewerId(): number {
  return viewerId ?? CURRENT_USER.id;
}

export function setViewerId(id: number) {
  if (id === getViewerId()) return;
  viewerId = id;
  listeners.forEach((l) => l());
}

/** The signed-in viewer's id, reactively. */
export function useViewerId(): number {
  return useSyncExternalStore(subscribe, getViewerId, getViewerId);
}

/** Name and email for a viewer id: CURRENT_USER, or a directory row. */
export function getViewerProfile(id: number): ViewerProfile {
  if (id === CURRENT_USER.id) {
    return { id, name: CURRENT_USER.name, email: CURRENT_USER.email };
  }
  const row = users.find((u) => u.id === id);
  return row
    ? { id, name: row.fullName, email: row.email }
    : { id: CURRENT_USER.id, name: CURRENT_USER.name, email: CURRENT_USER.email };
}

/** The signed-in viewer's profile, reactively. */
export function useViewer(): ViewerProfile {
  return getViewerProfile(useViewerId());
}
