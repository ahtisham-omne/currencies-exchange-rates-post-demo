/**
 * Cross-tab notification channel for "spawn-and-close" creation flows.
 *
 * When a creation CTA opens a new browser tab (e.g. "Create New Group" in
 * the partner-creation modal opens /partners/groups?action=create in a new
 * tab), the spawned tab needs to push the newly created record back to the
 * originating tab so the latter can update its local list and toast the
 * user — and then close itself. BroadcastChannel lets us do that without
 * either tab holding a reference to the other.
 *
 * Browsers without BroadcastChannel (e.g. older Safari) silently no-op —
 * the spawned tab still closes; the originating tab just won't see the
 * new record until manually refreshed. Acceptable degradation.
 */
const CHANNEL_NAME = "partner-spawned-creation";

export type SpawnedCreation =
  | { kind: "group"; payload: Record<string, unknown> }
  | { kind: "carrier"; payload: Record<string, unknown> };

export function broadcastSpawnedCreation(msg: SpawnedCreation): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage(msg);
    // Close on the next tick so the message has time to flush before
    // the spawned tab calls window.close() right after.
    setTimeout(() => ch.close(), 0);
  } catch {
    /* no-op */
  }
}

export function subscribeSpawnedCreations(
  handler: (msg: SpawnedCreation) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(CHANNEL_NAME);
  ch.onmessage = (e: MessageEvent<SpawnedCreation>) => handler(e.data);
  return () => ch.close();
}
