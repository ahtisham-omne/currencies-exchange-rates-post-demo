/* Store of completed imports. Lets the review modal push a new entry that
 * the listing page picks up next time it renders. Backed by localStorage,
 * an import log is an audit record, so it must be visible from every tab
 * (sessionStorage is per-tab and made imports recorded in one tab invisible
 * to a Data Imports page open in another).
 *
 * Session lifecycle: the listing is reset to a fixed pair of clean mock
 * entries on every fresh page load (full refresh or a new browser session).
 * New imports made during a session stack on top of those two and survive
 * in-app navigation, but a refresh clears them back to the two mocks. This
 * is driven by two cooperating pieces:
 *   1. A one-time store wipe that runs when this module is first evaluated —
 *      i.e. once per JS execution context (page load), and crucially BEFORE
 *      any import can be recorded (every write goes through this module, so
 *      the wipe always runs first). This is what makes a refresh reset.
 *   2. `ensureSeededForLoad`, which the listing calls to APPEND the two mock
 *      entries the first time a module is viewed. It is append-only, so an
 *      import recorded earlier this session (e.g. from the shared Import Users
 *      modal on the User Access Control page, before the module's listing was
 *      ever opened) is preserved rather than wiped. */

import { saveImportDetail } from "./importDetailStore";
import { saveRolesImportDetail } from "./rolesImportDetailStore";
import { buildRolesSeeds, buildUsersJuneSeed } from "./uacSeeds";
import type { ImportedUserRow, RowOutcome } from "./importRecords";
import { getModuleBySlug } from "./moduleData";
import { isNewTenant } from "../../data/tenant";

export interface CompletedImportEntry {
  id: string;
  moduleSlug: string;
  name: string;
  /** Name of the file the user uploaded for this import, shown as the
   *  import's name in the history listing. */
  fileName?: string;
  /** The free-text description the admin entered in the import wizard.
   *  Optional, blank when the admin skipped the field. Surfaced in the
   *  history table's Description column and the import detail header. */
  description?: string;
  dateISO: string;
  /** Importer key: matches USERS in DataImportDetailPage. */
  importerKey: "sj" | "ac" | "ra" | "am";
  recordCount: number;
  /** Per-outcome breakdown used by the listing's Result column. Failed counts
   *  both validator failures and rows the user skipped via the review modal,
   *  they share a single warning-tone tally because both still need a follow-up
   *  pass before the admin can consider the import "clean". */
  importedCount?: number;
  failedCount?: number;
  /** Set on a "fix" log: the id of the parent import whose failed rows were
   *  corrected and re-imported. A child log is nested under its parent in the
   *  listing (revealed by the parent's expand toggle) rather than appearing as
   *  its own top-level import.
   *
   *  The tree is deliberately one level deep. A child that still carries
   *  failures does not spawn a grandchild, its unresolved rows stay counted
   *  against the parent, because they are still the parent's rows to close
   *  out. One import, one problem to finish. */
  parentId?: string;
  /** How a child log came to be. Drives the listing's row glyph and label so
   *  an audit reader can tell a grid fix from an uploaded file at a glance.
   *  Absent on parent rows. */
  correctionKind?: "inline" | "reimport";
}

const STORAGE_KEY = "omne:import-history";

function read(): CompletedImportEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CompletedImportEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: CompletedImportEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* swallow: localStorage may be unavailable. */
  }
}

/* One-time reset per page load. This module is evaluated exactly once per JS
 * execution context — once per full page load (refresh / new session) and NOT
 * across in-app navigation. Wiping here clears the previous session's imports
 * before any new import can be recorded (addCompletedImport and the wizards all
 * live behind this module, so it is always evaluated first). The two mock
 * entries are re-seeded lazily per module by ensureSeededForLoad. Only the
 * history store is cleared; per-import detail payloads are keyed by id and are
 * harmless to leave (mock detail is re-seeded under stable ids). */
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore: localStorage may be unavailable. */
  }
}

export function addCompletedImport(entry: CompletedImportEntry): void {
  const list = read();
  write([entry, ...list]);
}

/** Record a correction as a CHILD log nested under its parent import. Created
 *  when failed rows on an existing import are fixed: instead of a new
 *  top-level entry, the fix folds under the parent (shown via its expand
 *  toggle).
 *
 *  Two kinds land here. An "inline" correction is always clean, the grid
 *  only commits rows that passed validation. A "reimport" correction comes
 *  from an uploaded file and may carry its own failures; those are recorded
 *  honestly on the child and stay counted against the parent, since the tree
 *  never grows a third level. */
export function addFixChildImport(entry: Omit<CompletedImportEntry, "parentId"> & { parentId: string }): void {
  addCompletedImport(entry);
}

/** Look up a single entry by id, across every module. Used by the correction
 *  flow to resolve the parent a stamped file names, including the case where
 *  the stamp points at another module's import. */
export function getCompletedImportById(id: string): CompletedImportEntry | null {
  return read().find((e) => e.id === id) ?? null;
}

/** Patch an existing entry's outcome counts, used when fixed rows are
 *  re-imported from the detail page so the listing's Result chips keep
 *  matching the rows the detail page now shows. */
export function updateCompletedImportCounts(
  id: string,
  counts: { importedCount: number; failedCount: number },
): void {
  const list = read();
  const idx = list.findIndex((e) => e.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...counts };
  write(list);
}

export function getCompletedImports(moduleSlug: string): CompletedImportEntry[] {
  return read().filter((e) => e.moduleSlug === moduleSlug);
}

/* ────────────────────────────────────
   Mock seed + per-load reset
   ──────────────────────────────────── */

/** Modules already seeded in THIS page load. Empty on every fresh load
 *  (refresh / new session), so we reset the module to its two mock entries
 *  once per load; stays populated across in-app navigation so a session's own
 *  imports are not wiped when the user leaves and returns to the page. */
const seededModules = new Set<string>();

/** Build a single clean mock user record (all outcomes "Created", no errors). */
function mockUserRow(row: number, seed: string, i: number): ImportedUserRow {
  const first = `${seed}${i}`;
  return {
    firstName: first,
    lastName: "Sample",
    emailAddress: `${seed.toLowerCase()}${i}@omnesoft.com`,
    licenseType: "Full Access",
    employeeStatus: "Active",
    assignedRoles: "",
    username: `${seed.toLowerCase()}${i}`,
    gender: "",
    dateOfBirth: "",
    preferredName: "",
    pronouns: "",
    jobTitle: "Associate",
    personalEmail: "",
    mobile: "",
    workPhone: "",
    homeAddress: "",
    workAddress: "",
    _row: row,
    _outcome: "Created" as RowOutcome,
  };
}

function mockRecords(count: number, seed: string): ImportedUserRow[] {
  return Array.from({ length: count }, (_, idx) => mockUserRow(idx + 1, seed, idx + 1));
}

/** The two clean past imports shown by default for a module. Fixed dates and
 *  ids so a reload always lands on the same pair. No failures — these predate
 *  the current session and are presented as already-clean history. */
function buildMockEntries(moduleSlug: string): { entry: CompletedImportEntry; records: ImportedUserRow[] }[] {
  const title = getModuleBySlug(moduleSlug)?.title ?? "Records";
  const noun = title.toLowerCase();
  return [
    {
      entry: {
        id: `imp-${moduleSlug}-1`,
        moduleSlug,
        name: `${title} — July update`,
        fileName: `${title.replace(/\s+/g, "_")}_July_2026.csv`,
        description: `Monthly ${noun} update`,
        dateISO: "2026-07-12T09:24:00.000Z",
        importerKey: "sj",
        recordCount: 12,
        importedCount: 12,
        failedCount: 0,
      },
      records: mockRecords(12, "Jul"),
    },
    {
      entry: {
        id: `imp-${moduleSlug}-2`,
        moduleSlug,
        name: `${title} — initial load`,
        fileName: `${title.replace(/\s+/g, "_")}_Initial_2026.csv`,
        description: `Initial ${noun} data load`,
        dateISO: "2026-06-28T14:05:00.000Z",
        importerKey: "ac",
        recordCount: 8,
        importedCount: 8,
        failedCount: 0,
      },
      records: mockRecords(8, "Jun"),
    },
  ];
}

/** Lay the given module's seeded history down the first time it is viewed in
 *  the current page load. Every module gets its two clean mock entries; User
 *  Access Control's surfaces get richer seeds from uacSeeds.ts: Users adds a
 *  June import with failed rows, and Roles seeds real role rows (into its own
 *  detail store) for all three of its imports. The store is emptied once at
 *  module load (see the top-level reset above), so this only lays seeds down,
 *  never wipes. It is APPEND-ONLY: imports recorded earlier this session are
 *  preserved and sort above the older seeds by date, and a seed already in the
 *  history (another surface laid it down this load) is not duplicated. Within
 *  a session, subsequent calls are a no-op. */
export function ensureSeededForLoad(moduleSlug: string): void {
  /* A company from onboarding has imported nothing yet. */
  if (isNewTenant()) return;
  if (!moduleSlug || seededModules.has(moduleSlug)) return;
  seededModules.add(moduleSlug);

  const existing = read();
  const existingIds = new Set(existing.map((e) => e.id));

  if (moduleSlug === "roles") {
    const fresh = buildRolesSeeds().filter((seed) => !existingIds.has(seed.entry.id));
    if (fresh.length === 0) return;
    write([...existing, ...fresh.map((seed) => seed.entry)]);
    for (const seed of fresh) {
      saveRolesImportDetail({
        id: seed.entry.id,
        moduleSlug,
        name: seed.entry.name,
        description: seed.entry.description,
        fileName: seed.entry.fileName ?? seed.entry.name,
        dateISO: seed.entry.dateISO,
        importerKey: seed.entry.importerKey,
        records: seed.records,
      });
    }
    return;
  }

  const seeds = buildMockEntries(moduleSlug);
  if (moduleSlug === "users") seeds.push(buildUsersJuneSeed());
  const fresh = seeds.filter((seed) => !existingIds.has(seed.entry.id));
  if (fresh.length === 0) return;

  /* Append at the end: the seeds carry the oldest dates, and the listing sorts
   * by date, so real session imports land above them regardless of array order. */
  write([...existing, ...fresh.map((m) => m.entry)]);

  /* Seed each mock's detail payload so drilling into it shows a populated
   * records table (the generic Users-shaped store). */
  for (const m of fresh) {
    saveImportDetail({
      id: m.entry.id,
      moduleSlug,
      name: m.entry.name,
      description: m.entry.description,
      fileName: m.entry.fileName ?? m.entry.name,
      dateISO: m.entry.dateISO,
      importerKey: m.entry.importerKey,
      records: m.records,
    });
  }
}
