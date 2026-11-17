/**
 * Photo lookups (randomuser.me), lifted out of
 * select-contact-directory-modal.tsx so it has one home instead of two —
 * that modal and the warehouse Activity Log both import from here.
 *
 * Two maps, because the two callers key differently. The contact
 * directory only ever had first names to go on, so PERSON_PHOTOS (the
 * original map, same name, same content) stays exactly as it was —
 * untouched, so the directory's own rendering doesn't change.
 * FULL_NAME_PHOTOS is for anyone a caller can name in full, which avoids
 * the real failure mode of a first-name-only map: two different Jameses
 * wearing the same face. personPhotoFor() tries full name first, then
 * first name, then gives up (undefined) so the caller's own tinted-
 * initials fallback takes over.
 */
export const PERSON_PHOTOS: Record<string, string> = {
  Sarah: "https://randomuser.me/api/portraits/women/44.jpg",
  Michael: "https://randomuser.me/api/portraits/men/32.jpg",
  Emily: "https://randomuser.me/api/portraits/women/65.jpg",
  David: "https://randomuser.me/api/portraits/men/75.jpg",
  Rachel: "https://randomuser.me/api/portraits/women/28.jpg",
  James: "https://randomuser.me/api/portraits/men/46.jpg",
  Lisa: "https://randomuser.me/api/portraits/women/17.jpg",
  Robert: "https://randomuser.me/api/portraits/men/22.jpg",
  Amanda: "https://randomuser.me/api/portraits/women/56.jpg",
  Kevin: "https://randomuser.me/api/portraits/men/64.jpg",
  Maria: "https://randomuser.me/api/portraits/women/33.jpg",
  Chris: "https://randomuser.me/api/portraits/men/85.jpg",
  Jessica: "https://randomuser.me/api/portraits/women/91.jpg",
  Andrew: "https://randomuser.me/api/portraits/men/41.jpg",
  Nicole: "https://randomuser.me/api/portraits/women/72.jpg",
  Thomas: "https://randomuser.me/api/portraits/men/55.jpg",
  Stephanie: "https://randomuser.me/api/portraits/women/15.jpg",
  Daniel: "https://randomuser.me/api/portraits/men/18.jpg",
  Karen: "https://randomuser.me/api/portraits/women/48.jpg",
  Brian: "https://randomuser.me/api/portraits/men/67.jpg",
};

/** Keyed on the full name specifically so two people sharing a first
 * name never wear the same face — everyone the warehouse Activity Log
 * actually names. */
export const FULL_NAME_PHOTOS: Record<string, string> = {
  "James Peterson": "https://randomuser.me/api/portraits/men/46.jpg",
  "Ahtsham Ahmad": "https://randomuser.me/api/portraits/men/52.jpg",
  "Marcus Doyle": "https://randomuser.me/api/portraits/men/61.jpg",
  "Diane Wu": "https://randomuser.me/api/portraits/women/39.jpg",
  "Priya Anand": "https://randomuser.me/api/portraits/women/50.jpg",
  "Sarah Kim": "https://randomuser.me/api/portraits/women/54.jpg",
  // These six share the exact TEAM avatar URLs from activity-log/data.ts
  // (the company-wide log's actor roster), so the same person wears the
  // same face on both log surfaces.
  "Faizan Khan":
    "https://images.unsplash.com/photo-1651596082255-bcb4993cee27?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYWtpc3RhbmklMjBtYW4lMjBidXNpbmVzcyUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MTg3ODcyMHww&ixlib=rb-4.1.0&q=80&w=1080",
  "Areeb Tanveer":
    "https://images.unsplash.com/photo-1676304918177-d60a7e1c7218?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaWRkbGUlMjBlYXN0ZXJuJTIwbWFuJTIwcHJvZmVzc2lvbmFsJTIwcGhvdG98ZW58MXx8fHwxNzcxODc4NzE5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  "Nophil Anwer":
    "https://images.unsplash.com/photo-1543132220-e7fef0b974e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMG1hbiUyMGJ1c2luZXNzJTIwcG9ydHJhaXQlMjBzdHVkaW98ZW58MXx8fHwxNzcxODc4NzE4fDA&ixlib=rb-4.1.0&q=80&w=1080",
  "Irtaza Abid":
    "https://images.unsplash.com/photo-1672685667592-0392f458f46f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MTgxODAxMHww&ixlib=rb-4.1.0&q=80&w=1080",
  "Eli Rosenbloom":
    "https://images.unsplash.com/photo-1691316749874-e89297ee4cf3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXVjYXNpYW4lMjBtYW4lMjBjb3Jwb3JhdGUlMjBoZWFkc2hvdHxlbnwxfHx8fDE3NzE4Nzg3MTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
  "Eesha Imtiaz":
    "https://images.unsplash.com/photo-1708491191986-f7a710ee4675?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb3V0aCUyMGFzaWFuJTIwd29tYW4lMjBwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdHxlbnwxfHx8fDE3NzMzMjQwMzh8MA&ixlib=rb-4.1.0&q=80&w=1080",
};

/** Full name first, then first name, then undefined — the caller's own
 * tinted-initials fallback takes over from there. */
export function personPhotoFor(name: string): string | undefined {
  return FULL_NAME_PHOTOS[name] ?? PERSON_PHOTOS[name.split(" ")[0]];
}
