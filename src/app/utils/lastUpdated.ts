/**
 * Deterministic mock "Last Updated By / On" derivation.
 *
 * The mock data model only carries createdBy/createdAt, so — following the
 * same id-hash idiom used elsewhere (getVendorGroups, getContactDetails) —
 * we derive a stable updater + update timestamp from the record id. The
 * derived date always lands between the record's creation date and today.
 */

export interface LastUpdatedInfo {
  name: string;
  initials: string;
  bgColor: string;
  role: string;
  email: string;
  phone: string;
  photoUrl?: string;
  /** ISO timestamp, always >= createdAt and <= now */
  date: string;
}

// Same team-member pool used for createdBy across the module's mock data.
const UPDATER_POOL: Omit<LastUpdatedInfo, "date">[] = [
  { name: "Ahtisham Ahmad", initials: "AA", bgColor: "#6366f1", role: "Senior Product Designer", email: "ahtisham@omnesoft.com", phone: "(312) 555-0164", photoUrl: "/avatars/ahtisham-ahmad.jpg" },
  { name: "Mahreen Ghafoor", initials: "MG", bgColor: "#10b981", role: "Frontend Engineer", email: "mahreen@omnesoft.com", phone: "(415) 555-0138", photoUrl: "/avatars/mahreen-ghafoor.png" },
  { name: "Eli Rosenbloom", initials: "ER", bgColor: "#8b5cf6", role: "Product Manager", email: "eli@omnesoft.com", phone: "(646) 555-0192", photoUrl: "/avatars/eli-rosenbloom.png" },
  { name: "Nophil Anwer", initials: "NA", bgColor: "#f59e0b", role: "Operations Analyst", email: "nophil@omnesoft.com", phone: "(555) 456-7890", photoUrl: "/avatars/nophil-anwer.png" },
  { name: "Irtaza Abid", initials: "IA", bgColor: "#ef4444", role: "Data Engineer", email: "irtaza@omnesoft.com", phone: "(555) 567-8901", photoUrl: "/avatars/irtaza-abid.jpg" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

const DAY_MS = 86400000;

export function getLastUpdated(id: string, createdAt?: string): LastUpdatedInfo {
  const h = hashString(String(id || "seed"));
  const person = UPDATER_POOL[h % UPDATER_POOL.length];

  const now = Date.now();
  const createdMs = createdAt ? new Date(createdAt).getTime() : now - 300 * DAY_MS;
  const created = Number.isFinite(createdMs) ? Math.min(createdMs, now) : now - 300 * DAY_MS;

  // Spread updates across the window between creation and today.
  const spanDays = Math.max(1, Math.floor((now - created) / DAY_MS));
  const offsetDays = h % spanDays;
  const updated = Math.min(created + offsetDays * DAY_MS + (h % 24) * 3600000, now);

  return { ...person, date: new Date(updated).toISOString() };
}
