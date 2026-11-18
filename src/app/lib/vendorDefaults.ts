// Vendor-level "default expense account" persistence.
//
// This repo has no backend or partner-level data store (the partner module
// is a separate app), so a vendor's default expense account is persisted in
// localStorage as a single JSON map { [vendorId]: account }. Reads fall back
// to the seeded mock value on the Vendor object when nothing is stored yet.
// Used by the standalone invoice to pre-fill line-item GL accounts.

const STORAGE_KEY = 'omne.vendorDefaultExpenseAccounts';

function readMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Resolve a vendor's default expense account: the user-persisted value if one
 * exists, otherwise the `fallback` (typically the seeded mock value on the
 * Vendor), otherwise an empty string.
 */
export function getVendorDefaultExpenseAccount(
  vendorId: string | null | undefined,
  fallback?: string,
): string {
  if (!vendorId) return fallback || '';
  const stored = readMap()[vendorId];
  return stored || fallback || '';
}

/** Persist (or update) a vendor's default expense account going forward. */
export function setVendorDefaultExpenseAccount(
  vendorId: string | null | undefined,
  account: string,
): void {
  if (typeof window === 'undefined' || !vendorId || !account) return;
  try {
    const map = readMap();
    map[vendorId] = account;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable (private mode / quota) — non-fatal.
  }
}
