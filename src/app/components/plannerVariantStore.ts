/* ═══════════════════════════════════════════════════════════════
   PLANNER SANDBOX VARIANT STORE
   Publish/subscribe pattern — mirrors plannerSession / cartStore.
   Owns which layout variant of the sandbox the buyer is on:
     · v1 — the 3-column layout (Vendors · Transactions · Graph)
     · v2 — graph on top (~30% height), Vendors + Transactions
            side-by-side underneath (~70%)
   The buyer flips between them via the workspace top-bar toggle;
   the choice persists in localStorage.
   ═══════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "po:planner-sandbox-variant:v1";

export type SandboxVariant = "v1" | "v2";
const VARIANT_VALUES: readonly SandboxVariant[] = ["v1", "v2"];
const DEFAULT_VARIANT: SandboxVariant = "v1";

let _variant: SandboxVariant = load();
type Listener = () => void;
const _listeners = new Set<Listener>();

function load(): SandboxVariant {
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    if (raw && VARIANT_VALUES.includes(raw as SandboxVariant)) {
      return raw as SandboxVariant;
    }
  } catch {
    /* ignore malformed / disabled storage */
  }
  return DEFAULT_VARIANT;
}

function persist() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, _variant);
    }
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function getSandboxVariant(): SandboxVariant {
  return _variant;
}

export function setSandboxVariant(v: SandboxVariant) {
  if (_variant === v) return;
  _variant = v;
  persist();
  _listeners.forEach((fn) => fn());
}

export function subscribeSandboxVariant(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function useSandboxVariant(): SandboxVariant {
  return useSyncExternalStore(
    subscribeSandboxVariant,
    getSandboxVariant,
    getSandboxVariant,
  );
}
