/* "Awaiting corrected file" state, one entry per import.
 *
 * Downloading an import's failed rows used to pop the re-import wizard the
 * same instant the file hit the disk, before the admin had fixed a single
 * cell. The only sensible action on that modal was Cancel. This store
 * replaces the ambush with a task that persists: the import remembers that
 * a correction is in flight, the detail page shows a resumable strip, and
 * the listing marks the row so the admin can pick it back up from either
 * surface.
 *
 * Session lifecycle mirrors importHistory.ts exactly, and deliberately. The
 * history store is wiped once per page load by design; a pending correction
 * points at an import id from that store, so letting it outlive the wipe
 * would leave the UI advertising a correction for an import that no longer
 * exists. Both stores reset together. */

export interface PendingCorrection {
  /** The import whose failed rows were downloaded. */
  importId: string;
  moduleSlug: string;
  /** Name of the file that was handed to the admin, e.g.
   *  "Q2_New_Hires_2026_failed.csv". */
  fileName: string;
  /** How many failed rows went into it. */
  rowCount: number;
  /** ISO timestamp of the download, drives the "downloaded at" line. */
  startedISO: string;
}

const STORAGE_KEY = "omne:import-pending-corrections";

function read(): Record<string, PendingCorrection> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PendingCorrection>) : {};
  } catch {
    return {};
  }
}

function write(value: Record<string, PendingCorrection>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* swallow: localStorage may be unavailable or over quota. The worst
     * case is that the strip doesn't survive navigation. */
  }
}

/* One-time reset per page load, in lockstep with importHistory.ts. See the
 * module header: a pending correction is only meaningful while its parent
 * import is still in the history store. */
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore: localStorage may be unavailable. */
  }
}

/** Mark an import as awaiting a corrected file. Overwrites any earlier
 *  pending state for the same import, a second download supersedes the
 *  first. */
export function startPendingCorrection(entry: PendingCorrection): void {
  const all = read();
  all[entry.importId] = entry;
  write(all);
  notify();
}

/** Clear an import's pending state. Called when the corrected file lands,
 *  when the admin dismisses the strip, and when inline fixes close out the
 *  last failed row (there is nothing left to correct by file). */
export function clearPendingCorrection(importId: string): void {
  const all = read();
  if (!(importId in all)) return;
  delete all[importId];
  write(all);
  notify();
}

export function getPendingCorrection(importId: string): PendingCorrection | null {
  return read()[importId] ?? null;
}

/** Every pending correction in a module, keyed by import id. The listing
 *  reads this once per render pass rather than probing per row. */
export function getPendingCorrections(moduleSlug: string): Record<string, PendingCorrection> {
  const out: Record<string, PendingCorrection> = {};
  for (const [id, entry] of Object.entries(read())) {
    if (entry.moduleSlug === moduleSlug) out[id] = entry;
  }
  return out;
}

/* ────────────────────────────────────
   Change notification
   ──────────────────────────────────── */

/* The detail page and the listing can both be mounted against the same
 * pending state (the listing sits behind the detail route in history). A
 * plain custom event keeps them in sync inside one tab; cross-tab sync
 * rides the native `storage` event, same as the history store. */
const EVENT_NAME = "omne:pending-corrections-changed";

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/** Subscribe to pending-correction changes from this tab and from others.
 *  Returns an unsubscribe function. */
export function subscribeToPendingCorrections(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
