/* External-link repository, keyed by quote id. Replaces the
 * `external-link` category that used to live inside the Attachments
 * tab. The Deal Information tab renders the full repository as its
 * "Links" section, and External Notes / adjustment internalNotes
 * attach individual link ids as compact chip references.
 *
 * Module-level so navigating between records preserves state within a
 * session, matching the outdatedConfigs registry pattern. */

export interface ExternalLink {
  id: string;
  label: string;
  url: string;
  addedBy: string;
  addedAt: string;
}

const REPO: Record<string, ExternalLink[]> = {};

/* External-links textarea contents, per doc id. The Deal Information
 * tab now renders a single multi-line textarea instead of individual
 * label/url chips. Each non-empty line is one URL; downstream PDF
 * surfaces render the list plain (no `[N]` markers) — sales reps
 * reference the URL inline in their descriptions if they want to
 * point at a specific one. */
const TEXT_REPO: Record<string, string> = {};

/* Small subscription set so React consumers re-render when the shared
   store mutates. Simple pub/sub keeps the API surface tiny — callers
   just useEffect around it. */
type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeToLinksRepository(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getExternalLinksText(id: string | undefined | null): string {
  if (!id) return '';
  return TEXT_REPO[id] ?? '';
}

export function setExternalLinksText(id: string, text: string): void {
  TEXT_REPO[id] = text;
  notify();
}

/** Split the textarea contents into a clean URL list — non-empty
 *  trimmed lines only. Used by PDF adapters. */
export function getExternalLinksList(id: string | undefined | null): string[] {
  return getExternalLinksText(id)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function getLinksForId(id: string | undefined | null): ExternalLink[] {
  if (!id) return [];
  return REPO[id] ?? [];
}

export function addLinkForId(id: string, input: { label: string; url: string; addedBy: string }): ExternalLink {
  const link: ExternalLink = {
    id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: input.label,
    url: input.url,
    addedBy: input.addedBy,
    addedAt: new Date().toISOString().slice(0, 10),
  };
  const list = REPO[id] ?? [];
  REPO[id] = [link, ...list];
  notify();
  return link;
}

export function removeLinkForId(id: string, linkId: string): void {
  const list = REPO[id];
  if (!list) return;
  REPO[id] = list.filter((l) => l.id !== linkId);
  notify();
}

/* Seeded demo entries so the "Outdated Configurations" hero record
   opens with a couple of links to show what the surface looks like.
   The keys match the hero-record ids used elsewhere so navigating to
   Q-000-000-042 (or its SO twin) surfaces the sample repository. */
function seedDemoLinks(): void {
  const now = new Date();
  const stamp = (daysAgo: number) => {
    const d = new Date(now.getTime() - daysAgo * 86400000);
    return d.toISOString().slice(0, 10);
  };
  const DEMO_IDS = ['so-outdated-demo', 'SO-000-000-042'];
  DEMO_IDS.forEach((docId) => {
    if (REPO[docId]) return;
    REPO[docId] = [
      {
        id: `link-seed-${docId}-1`,
        label: 'Master Purchase Agreement',
        url: 'https://docs.example.com/agreements/mpa-2026',
        addedBy: 'Sarah Chen',
        addedAt: stamp(6),
      },
      {
        id: `link-seed-${docId}-2`,
        label: 'NFPA 1917 Compliance Matrix',
        url: 'https://sharepoint.example.com/safety/nfpa1917',
        addedBy: 'Michael Rodriguez',
        addedAt: stamp(3),
      },
    ];
    if (!TEXT_REPO[docId]) {
      TEXT_REPO[docId] = [
        'https://docs.example.com/agreements/mpa-2026',
        'https://sharepoint.example.com/safety/nfpa1917',
      ].join('\n');
    }
  });
}
seedDemoLinks();
