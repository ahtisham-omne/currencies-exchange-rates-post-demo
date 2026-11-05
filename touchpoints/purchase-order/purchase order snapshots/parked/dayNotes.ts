/* ═══════════════════════════════════════════════════════════════
   PLANNER — PERSONAL DAY NOTES
   ───────────────────────────────────────────────────────────────
   Per-item, per-day text notes the buyer jots for their own future
   reference (e.g. "Waiting on quote", "Nophil to confirm"). Storage
   is `localStorage` keyed by `${itemCode}:${dayOffset}` — never
   shared, never leaves this browser. The mock has no user-auth
   layer so "personal" is implicit.

   Each day-key holds an ARRAY of notes so the buyer can jot several
   reminders on the same day (Enter or Save appends a new entry and
   clears the input, ready for the next). Used by:
     · [[PlannerGapGraph]] `DayNoteEditor` — inline editor + list on
       the day-detail card.
   ═══════════════════════════════════════════════════════════════ */

/* Storage key bumped v2 → v3 for the day-offset → ISO-date shape
   change. The offset used to shift every calendar day (a note saved
   today at day=13 became day=12 tomorrow), so notes appeared to
   vanish overnight. Keying by the note's actual ISO date fixes it.
   Old v2 payloads are dropped on load — no reliable way to guess the
   absolute date from a relative offset without a timestamp, and this
   is a demo/mock. */
const KEY = "po:planner:day-notes:v3";

function isoForDay(day: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + day);
  /* Local Y/M/D — avoids toISOString() timezone shifts around midnight. */
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function storageKey(itemCode: string, day: number): string {
  return `${itemCode}:${isoForDay(day)}`;
}

function readAll(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        out[k] = v.filter((s): s is string => typeof s === "string");
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, string[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / serialization errors */
  }
}

/** All notes the buyer saved for this `itemCode` / `day` pair, in
    insertion order (oldest first). Empty array when none exist. */
export function loadDayNotes(itemCode: string, day: number): string[] {
  return readAll()[storageKey(itemCode, day)] ?? [];
}

/** Append a new note. Trimmed empty strings are ignored so the buyer
    can't accidentally save blank rows. Returns the updated list. */
export function addDayNote(itemCode: string, day: number, note: string): string[] {
  const trimmed = note.trim();
  if (!trimmed) return loadDayNotes(itemCode, day);
  const all = readAll();
  const k = storageKey(itemCode, day);
  const next = [...(all[k] ?? []), trimmed];
  all[k] = next;
  writeAll(all);
  return next;
}

/** Remove the note at `index` from this day's list. Returns the
    updated list — empty when the last note was removed. */
export function removeDayNote(itemCode: string, day: number, index: number): string[] {
  const all = readAll();
  const k = storageKey(itemCode, day);
  const list = all[k] ?? [];
  if (index < 0 || index >= list.length) return list;
  const next = list.filter((_, i) => i !== index);
  if (next.length > 0) all[k] = next;
  else delete all[k];
  writeAll(all);
  return next;
}
