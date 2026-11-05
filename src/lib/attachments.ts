import { supabase } from "@/integrations/supabase/client";

export const ATTACHMENTS_BUCKET = "attachments";

/** Long-lived signed URL (1 year). Bucket is private until workspace allows public buckets. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

const urlCache = new Map<string, { url: string; expires: number }>();

/**
 * Resolve a remote URL for an attachment stored in Supabase Storage.
 * Returns null on error.
 */
export async function resolveStorageUrl(filePath: string): Promise<string | null> {
  if (!filePath) return null;
  const cached = urlCache.get(filePath);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;

  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[attachments] failed to sign url", filePath, error);
    return null;
  }
  urlCache.set(filePath, {
    url: data.signedUrl,
    expires: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

/** Build a storage object path for an attachment. */
export function buildAttachmentPath(
  entityType: string,
  entityId: string,
  fileName: string,
): string {
  const safeEntity = (entityType || "misc").replace(/[^a-z0-9_-]/gi, "_");
  const safeId = (entityId || "draft").replace(/[^a-z0-9_-]/gi, "_");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = fileName.replace(/[^a-z0-9._-]/gi, "_");
  return `${safeEntity}/${safeId}/${stamp}-${safeName}`;
}
