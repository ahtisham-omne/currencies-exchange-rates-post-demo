/* ── Running inside the Currency & Exchange Rates shell ──────────────
 * The shell (currencies-exchange-rates-post-demo) shows this app in an
 * iframe on the same origin, served under /touchpoint-apps/chart-of-accounts/
 * (vite --base), and draws its own sidebar. Everything the app needs to
 * behave there lives in this file, so the rest of the source stays as the
 * design repo ships it:
 *  - `embedded`: AppShell hides the app's own sidebar.
 *  - `asset`: files in public/ (avatars) load from this app's base path.
 *  - Root-relative links ("/chart-of-accounts/1000") resolve against this
 *    app's base path. Links that open a new tab get the shell's page for
 *    them, so the new tab shows the whole shell.
 *  - The "Accounting" crumb (/accounting) opens the shell's own Accounting
 *    overview, which stands in for this app's overview page. */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const embedded = (() => {
  try {
    return window.self !== window.top && "__OMNE_SHELL__" in window.parent;
  } catch {
    return false;
  }
})();

/** A file in public/, e.g. asset("/avatars/eli.png"), wherever the app is served. */
export const asset = (path: string) => BASE + path;

interface ShellBridge {
  urlFor?: (url: string) => string | null;
  navigate?: (path: string) => void;
}

const shell = (): ShellBridge | undefined => {
  try {
    return (window.parent as unknown as { __OMNE_SHELL__?: ShellBridge }).__OMNE_SHELL__;
  } catch {
    return undefined;
  }
};

/** In-app paths the shell draws itself (the same path in the shell). */
const SHELL_PAGE = /^\/accounting(?=[?#]|$)/;

/** An in-app path such as "/chart-of-accounts/1000" (not "//host" and not already based). */
function isAppPath(url: string): boolean {
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  return !BASE || !(url === BASE || url.startsWith(BASE + "/"));
}

/** The in-app path a link names: a root-relative path, or, for a page the
 *  shell draws, the based URL a router Link renders ("<base>/accounting"). */
function linkPath(href: string): string | null {
  if (isAppPath(href)) return href;
  if (embedded && BASE && href.startsWith(BASE + "/") && SHELL_PAGE.test(href.slice(BASE.length))) {
    return href.slice(BASE.length);
  }
  return null;
}

/** Where an in-app path lives for a new tab: the shell's page when embedded, else this app's. */
export function appUrl(path: string): string {
  if (embedded) {
    if (SHELL_PAGE.test(path)) return path;
    const url = shell()?.urlFor?.(BASE + path);
    if (url) return url;
  }
  return BASE + path;
}

let navigateInApp: ((path: string) => void) | null = null;

/** The router's navigate, for plain in-app link clicks (set by EmbeddingBridge, inside the router). */
export function setInAppNavigator(navigate: ((path: string) => void) | null) {
  navigateInApp = navigate;
}

/** A left click with no modifier on a link that opens in this tab. */
function plainClick(event: Event, a: HTMLAnchorElement): boolean {
  const e = event as MouseEvent;
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  return !(a.target && a.target !== "_self") && !a.hasAttribute("download");
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
      const path = linkPath(href);
      if (path === null) {
        delete a.dataset.appPath;
        delete a.dataset.appHref;
        return;
      }
      a.dataset.appPath = path;
    }
    const path = a.dataset.appPath!;
    const url = appUrl(path);
    a.dataset.appHref = url;
    a.setAttribute("href", url);

    // A page the shell draws: the shell goes there, before the router (a
    // Link's own click handler) can open this app's copy of it.
    const toShell = embedded && SHELL_PAGE.test(path) ? shell()?.navigate : undefined;
    if (event.type === "click" && toShell && plainClick(event, a)) {
      event.preventDefault();
      event.stopPropagation();
      toShell(path);
    }
  };
  for (const type of ["mousedown", "click", "auxclick", "contextmenu", "focusin"]) {
    document.addEventListener(type, resolve, true);
  }

  // A plain click on such a link that no handler took over stays in the app.
  document.addEventListener("click", (event) => {
    const a = (event.target as Element | null)?.closest?.("a[data-app-path]");
    if (!(a instanceof HTMLAnchorElement) || !navigateInApp || !plainClick(event, a)) return;
    event.preventDefault();
    navigateInApp(a.dataset.appPath!);
  });
}
