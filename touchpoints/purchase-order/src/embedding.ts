/* ── Running inside the Currency & Exchange Rates shell ──────────────
 * The shell (currencies-exchange-rates-post-demo) shows this app in an
 * iframe on the same origin, served under /touchpoint-apps/purchase-order/
 * (vite --base), and draws its own sidebar. Everything the app needs to
 * behave there lives in this file, so the rest of the source stays as the
 * design repo ships it:
 *  - `embedded`: AppShell hides the app's own sidebar.
 *  - Root-relative links ("/purchase-orders/PO-1", window.open('/cart'))
 *    resolve against this app's base path. Links that open a new tab get the
 *    shell's page for them, so the new tab shows the whole shell. */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const embedded = (() => {
  try {
    return window.self !== window.top && "__OMNE_SHELL__" in window.parent;
  } catch {
    return false;
  }
})();

/** An in-app path such as "/purchase-orders/PO-1" (not "//host" and not already based). */
function isAppPath(url: string): boolean {
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  return !BASE || !(url === BASE || url.startsWith(BASE + "/"));
}

/** Where an in-app path lives for a new tab: the shell's page when embedded, else this app's. */
export function appUrl(path: string): string {
  if (embedded) {
    try {
      const shell = (window.parent as unknown as { __OMNE_SHELL__?: { urlFor?: (url: string) => string | null } }).__OMNE_SHELL__;
      const url = shell?.urlFor?.(BASE + path);
      if (url) return url;
    } catch {
      // The shell can't answer; fall back to this app's own page.
    }
  }
  return BASE + path;
}

/** A full link to this page (with `hash` instead of the current one, if
 *  given) for copying: the shell's page when embedded. */
export function appHref(hash?: string): string {
  const here = window.location.pathname.slice(BASE.length) || "/";
  const path = hash === undefined ? here + window.location.search + window.location.hash : here + hash;
  return new URL(appUrl(path), window.location.origin).href;
}

let navigateInApp: ((path: string) => void) | null = null;

/** The router's navigate, for plain in-app link clicks (set in routes.tsx). */
export function setInAppNavigator(navigate: ((path: string) => void) | null) {
  navigateInApp = navigate;
}

if (BASE || embedded) {
  const open = window.open.bind(window);
  window.open = ((url?: string | URL, ...rest: [string?, string?]) =>
    open(typeof url === "string" && isAppPath(url) ? appUrl(url) : url, ...rest)) as typeof window.open;

  // Before the browser follows a link (or offers "open in new tab"), point it at the right page.
  const resolve = (event: Event) => {
    const a = (event.target as Element | null)?.closest?.("a[href]");
    if (!(a instanceof HTMLAnchorElement)) return;
    const href = a.getAttribute("href") ?? "";
    // React can reuse the anchor for another target: when its href is no
    // longer the one written here, read the new one.
    if (a.dataset.appHref !== href) {
      if (!isAppPath(href)) {
        delete a.dataset.appPath;
        delete a.dataset.appHref;
        return;
      }
      a.dataset.appPath = href;
    }
    const url = appUrl(a.dataset.appPath!);
    a.dataset.appHref = url;
    a.setAttribute("href", url);
  };
  for (const type of ["mousedown", "click", "auxclick", "contextmenu", "focusin"]) {
    document.addEventListener(type, resolve, true);
  }

  // A plain click on such a link that no handler took over stays in the app.
  document.addEventListener("click", (event) => {
    const a = (event.target as Element | null)?.closest?.("a[data-app-path]");
    if (!(a instanceof HTMLAnchorElement) || !navigateInApp) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    event.preventDefault();
    navigateInApp(a.dataset.appPath!);
  });
}
