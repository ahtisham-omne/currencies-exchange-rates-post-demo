/**
 * storage.ts — PO stub for `resolveStorageUrl`.
 *
 * The Items-V2 source resolves Supabase Storage signed URLs here. PO has no
 * Supabase integration, so the resolver always returns `null` — the preview
 * modal falls back to the local blob preview URL on the attachment record.
 */

export async function resolveStorageUrl(
  _filePath: string | null | undefined,
): Promise<string | null> {
  return null;
}
