/**
 * Storage-URL resolver stub. Mirrors the helper signature used by the
 * Physical Inventory module so attachment code can be ported without
 * branching. Quote/SO have no storage backend yet, so this returns the
 * input URL unchanged.
 */
export async function resolveStorageUrl(input: string): Promise<string> {
  return input;
}

/** Sync variant for callers that don't want to await. */
export function resolveStorageUrlSync(input: string): string {
  return input;
}
