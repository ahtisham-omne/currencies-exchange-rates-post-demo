/* ──────── Reset MFA: "confirm it's you" (ERP-5179, 12 Nov 2026) ────────
 *
 * Mirrors Security Settings' lib/mfaReauth. Hamza and Fatima, 12 Nov 2026: the
 * ERP never takes a password in its own dialog, so Reset MFA has no password or
 * reason field. Reset User MFA sends the admin to the sign-in page (one page for
 * every module, as Keycloak is: the Security Settings prototype's
 * /account-security/confirm), they sign in the way they normally do, and come
 * back here with the reset done (ResetMfaReturn). Someone who confirmed in the
 * last few minutes isn't asked again. */

/** Where the shared sign-in page lives. Set VITE_SECURITY_SETTINGS_ORIGIN to point
 *  at a local Security Settings dev server. */
export const SECURITY_SETTINGS_ORIGIN: string =
  (import.meta.env.VITE_SECURITY_SETTINGS_ORIGIN as string | undefined) || "https://fusion-zen.lovable.app";

/** Placeholder: Fatima asked Hamza for the real window on 12 Nov 2026. */
export const REAUTH_WINDOW_MS = 5 * 60_000;

const STORAGE_KEY = "uac:mfa-reauth-at";

export const RESET_PARAM = "mfaReset";
export const CONFIRMED_AT_PARAM = "confirmedAt";

export function markConfirmed(at = Date.now()) {
  try {
    localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    /* Storage blocked: the admin is asked again next time, which is safe. */
  }
}

export function recentlyConfirmed(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(at) && at > 0 && now - at < REAUTH_WINDOW_MS;
  } catch {
    return false;
  }
}

/** Off to the sign-in page to reset `userId`'s MFA, coming back to this page. */
export function goConfirmIdentity(userId: number, userName: string) {
  const back = new URL(window.location.href);
  back.searchParams.delete(RESET_PARAM);
  back.searchParams.delete(CONFIRMED_AT_PARAM);
  const q = new URLSearchParams({ for: userName, [RESET_PARAM]: String(userId), returnTo: back.toString() });
  window.location.assign(`${SECURITY_SETTINGS_ORIGIN}/account-security/confirm?${q}`);
}
