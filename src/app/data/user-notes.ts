import { useSyncExternalStore } from "react";
import { sampleOnly } from "./tenant";

/* ─── User notes (ERP-5167 AC3, backend ERP-5414) ───
 *
 * One list of notes per user, kept in memory for the prototype. The Notes tab
 * writes it and the Overview Notes widget reads it, so a note added on the
 * tab shows on the widget too. Notes are not permission controlled (Eli,
 * 7 Oct 2026): anyone who can open the user can view, add and delete them,
 * and there is no character limit. */

export interface UserNote {
  id: string;
  text: string;
  author: string;
  /** ISO 8601. */
  timestamp: string;
}

/* Sample notes every sample user starts with; a company from onboarding has
   none yet. */
const SEED: UserNote[] = [
  {
    id: "seed-1",
    author: "Andrea Davis",
    timestamp: "2026-03-15T09:30:00",
    text: "Discussed role transition during Q1 planning. Expressed interest in moving to a warehouse supervisor position when a spot opens up.",
  },
  {
    id: "seed-2",
    author: "Taylor Dimas",
    timestamp: "2026-02-20T14:15:00",
    text: "Completed onboarding checklist. All required training modules finished ahead of schedule.",
  },
];

const notesByUser = new Map<number, UserNote[]>();
const listeners = new Set<() => void>();

export function getUserNotes(userId: number): UserNote[] {
  let notes = notesByUser.get(userId);
  if (!notes) {
    notes = sampleOnly(SEED);
    notesByUser.set(userId, notes);
  }
  return notes;
}

export function setUserNotes(userId: number, next: UserNote[]): void {
  notesByUser.set(userId, next);
  listeners.forEach((l) => l());
}

export function subscribeUserNotes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUserNotes(userId: number): UserNote[] {
  return useSyncExternalStore(subscribeUserNotes, () => getUserNotes(userId));
}

/** Newest first. */
export function sortNotesNewestFirst(notes: readonly UserNote[]): UserNote[] {
  return [...notes].sort(
    (a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0),
  );
}

/** "Mar 15, 2026, 9:30 AM". */
export function formatNoteTime(timestamp: string): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return timestamp;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
